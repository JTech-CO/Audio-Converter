// Web Worker 초기화
const audioWorker = new Worker('worker.js');

/**
 * @description 오디오 파일 업로드 및 처리 시작
 */
document.getElementById('audioInput').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file || file.size > 20 * 1024 * 1024) {
        alert('20MB 이하의 파일을 업로드하세요.');
        return;
    }

    const genre = document.getElementById('genreSelect').value;
    if (!genre) {
        alert('장르를 선택하세요.');
        return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
        const audioData = event.target.result;
        audioWorker.postMessage({ audioData, genre });
    };
    reader.readAsArrayBuffer(file);
});

/**
 * @description Web Worker로부터 처리 결과 수신
 */
audioWorker.onmessage = (e) => {
    const { progress, result } = e.data;
    const progressBar = document.getElementById('progressBar');
    const downloadBtn = document.getElementById('downloadBtn');

    if (progress !== undefined) {
        progressBar.value = progress;
    }

    if (result) {
        const blob = new Blob([result], { type: 'audio/wav' });
        const url = URL.createObjectURL(blob);
        downloadBtn.href = url;
        downloadBtn.download = 'converted_audio.wav';
        downloadBtn.disabled = false;
    }
};

/**
 * @description 장르 선택 시 버튼 비활성화 초기화
 */
document.getElementById('genreSelect').addEventListener('change', () => {
    document.getElementById('downloadBtn').disabled = true;
});