# 音频资源说明

LifeFlow 专注模式支持声音提醒功能。

## 添加提示音

在 `frontend/assets/` 目录下放置以下音频文件：

### completion.mp3
专注完成时的提示音

**推荐音频**：
- 可以从免费音效网站下载，如：
  - [Freesound](https://freesound.org/)
  - [Zapsplat](https://www.zapsplat.com/)
  - [Mixkit](https://mixkit.co/free-sound-effects/)

**音频要求**：
- 格式：MP3
- 时长：1-3秒
- 音量：适中，不刺耳
- 风格：清脆、愉悦的提示音

**创建 assets 目录**：
```powershell
mkdir frontend\assets
```

然后将下载的音效文件重命名为 `completion.mp3` 并放入该目录。

## 临时方案

如果暂时没有音频文件，系统会正常运行，只是不会播放声音。浏览器控制台可能会显示警告，但不影响其他功能。

## 自定义音效

你也可以：
1. 录制自己的提示音
2. 使用在线文字转语音工具生成
3. 使用音乐制作软件创建简单的提示音

记得保存为 MP3 格式！
