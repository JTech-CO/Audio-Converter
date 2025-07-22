/**
 * @description Web Audio API를 사용한 BPM 검출
 * @param {AudioBuffer} audioBuffer - 입력 오디오 버퍼
 * @returns {number} - 검출된 BPM
 */
function detectBPM(audioBuffer) {
    const offlineContext = new OfflineAudioContext(1, audioBuffer.length, audioBuffer.sampleRate);
    const source = offlineContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(offlineContext.destination);
    source.start();

    return offlineContext.startRendering().then(renderedBuffer => {
        const channelData = renderedBuffer.getChannelData(0);
        let peaks = [];
        for (let i = 1; i < channelData.length - 1; i++) {
            if (channelData[i] > channelData[i - 1] && channelData[i] > channelData[i + 1] && channelData[i] > 0.1) {
                peaks.push(i);
            }
        }

        const intervals = peaks.slice(1).map((peak, idx) => peak - peaks[idx]);
        const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
        return Math.round((audioBuffer.sampleRate / avgInterval) * 60);
    });
}

/**
 * @description 템포 스트레칭 (간단한 리샘플링)
 * @param {AudioBuffer} audioBuffer - 입력 오디오 버퍼
 * @param {number} targetBPM - 목표 BPM
 * @param {number} originalBPM - 원본 BPM
 * @returns {AudioBuffer} - 변환된 오디오 버퍼
 */
function stretchTempo(audioBuffer, targetBPM, originalBPM) {
    const factor = originalBPM / targetBPM;
    const newLength = Math.round(audioBuffer.length * factor);
    const offlineContext = new OfflineAudioContext(1, newLength, audioBuffer.sampleRate);
    const source = offlineContext.createBufferSource();
    source.buffer = audioBuffer;
    source.playbackRate.value = factor;
    source.connect(offlineContext +

destination);
    source.start();
    return offlineContext.startRendering();
}

/**
 * @description 샘플 레이어링 (킥 추가 예시)
 * @param {AudioBuffer} audioBuffer - 입력 오디오 버퍼
 * @param {string} genre - 선택된 장르
 * @returns {AudioBuffer} - 샘플이 추가된 오디오 버퍼
 */
function layerSamples(audioBuffer, genre) {
    const sampleRate = audioBuffer.sampleRate;
    const kick = new Float32Array(sampleRate * 0.1); // 0.1초 킥 사운드 예시
    for (let i = 0; i < kick.length; i++) {
        kick[i] = Math.sin(2 * Math.PI * 50 * i / sampleRate) * (1 - i / kick.length);
    }

    const newBuffer = audioBuffer.getChannelData(0).slice();
    for (let i = 0; i < newBuffer.length; i += sampleRate) {
        for (let j = 0; j < kick.length && i + j < newBuffer.length; j++) {
            newBuffer[i + j] += kick[j] * 0.5;
        }
    }

    const offlineContext = new OfflineAudioContext(1, audioBuffer.length, sampleRate);
    const buffer = offlineContext.createBuffer(1, audioBuffer.length, sampleRate);
    buffer.copyToChannel(newBuffer, 0);
    return Promise.resolve(buffer);
}

/**
 * @description Worker 메시지 처리
 */
self.onmessage = async (e) => {
    const { audioData, genre } = e.data;
    const audioContext = new AudioContext();
    const audioBuffer = await audioContext.decodeAudioData(audioData);

    self.postMessage({ progress: 20 });
    const originalBPM = await detectBPM(audioBuffer);
    self.postMessage({ progress: 40 });

    const targetBPMs = { hardstyle: 150, techno: 130, trance: 138, hardbass: 150, lofi: 90 };
    const stretchedBuffer = await stretchTempo(audioBuffer, targetBPMs[genre], originalBPM);
    self.postMessage({ progress: 60 });

    const finalBuffer = await layerSamples(stretchedBuffer, genre);
    self.postMessage({ progress: 80 });

    const wavBlob = bufferToWave(finalBuffer, finalBuffer.length);
    self.postMessage({ progress: 100, result: wavBlob });
};

/**
 * @description AudioBuffer를 WAV 파일로 변환
 * @param {AudioBuffer} abuffer - 오디오 버퍼
 * @param {number} len - 버퍼 길이
 * @returns {ArrayBuffer} - WAV 형식의 ArrayBuffer
 */
function bufferToWave(abuffer, len) {
    const numOfChan = abuffer.numberOfChannels;
    const length = len * numOfChan * 2 + 44;
    const buffer = new ArrayBuffer(length);
    const view = new DataView(buffer);
    const channels = [];
    let offset = 0;

    // WAV 헤더 작성
    writeString(view, offset, 'RIFF'); offset += 4;
    view.setUint32(offset, 36 + len * numOfChan * 2, true); offset += 4;
    writeString(view, offset, 'WAVE'); offset += 4;
    writeString(view, offset, 'fmt '); offset += 4;
    view.setUint32(offset, 16, true); offset += 4;
    view.setUint16(offset, 1, true); offset += 2;
    view.setUint16(offset, numOfChan, true); offset += 2;
    view.setUint32(offset, abuffer.sampleRate, true); offset += 4;
    view.setUint32(offset, abuffer.sampleRate * 2 * numOfChan, true); offset += 4;
    view.setUint16(offset, numOfChan * 2, true); offset += 2;
    view.setUint16(offset, 16, true); offset += 2;
    writeString(view, offset, 'data'); offset += 4;
    view.setUint32(offset, len * numOfChan * 2, true); offset += 4;

    for (let i = 0; i < abuffer.numberOfChannels; i++) {
        channels.push(abuffer.getChannelData(i));
    }

    for (let i = 0; i < len; i++) {
        for (let chan = 0; chan < numOfChan; chan++) {
            const sample = Math.max(-1, Math.min(1, channels[chan][i]));
            view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
            offset += 2;
        }
    }

    return buffer;
}

function writeString(view, offset, string) {
    for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
    }
}