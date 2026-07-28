document.addEventListener('DOMContentLoaded', () => {
  const apiKeyInput = document.getElementById('apiKeyInput');
  const saveBtn = document.getElementById('saveBtn');
  const statusDiv = document.getElementById('status');

  // Tải API key đã lưu trước đó (nếu có)
  chrome.storage.sync.get(['pandascoreApiKey'], (result) => {
    if (result.pandascoreApiKey) {
      apiKeyInput.value = result.pandascoreApiKey;
    }
  });

  // Lưu API key khi bấm nút
  saveBtn.addEventListener('click', () => {
    const apiKey = apiKeyInput.value.trim();
    if (!apiKey) {
      statusDiv.style.color = '#d63031';
      statusDiv.textContent = 'API Key không được để trống!';
      return;
    }

    chrome.storage.sync.set({ pandascoreApiKey: apiKey }, () => {
      statusDiv.style.color = '#1b8f3a';
      statusDiv.textContent = 'Đã lưu thành công!';
      setTimeout(() => {
        statusDiv.textContent = '';
      }, 2000);
    });
  });
});