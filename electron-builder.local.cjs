// electron-builder.local.cjs
// 本机没有 cmake / MSVC / gcc / Rust，编不了 beforePack 里那些原生件
// （ffmpeg、MNN 分析运行时、壁纸助手、windowtolayer），所以这份配置：
//   - 摘掉 beforePack / afterPack 两个钩子；
//   - 只保留确实存在的 extraResources（图标、托盘图、Linux 桌面项等）；
//   - 去掉 Windows 的壁纸助手 extraResource。
// 产物仍是正式的 NSIS 安装包，只是少了「智能动感 / BeatFX 音频分析」这些依赖原生运行时的功能。
// 要完整官方包请走仓库的 GitHub Actions（见 .github/workflows/release-candidate.yml）。
const base = { ...require('./package.json').build };

delete base.beforePack;
delete base.afterPack;

const GENERATED = ['${os}', 'models', 'windowtolayer', 'folia-wallpaper-helper.exe'];
const keep = (entry) => {
    const from = String(entry.from ?? '');
    const filter = (entry.filter ?? []).join(',');
    return !GENERATED.some(marker => from.includes(marker) || filter.includes(marker));
};

module.exports = {
    ...base,
    extraResources: (base.extraResources ?? []).filter(keep),
    win: {
        ...base.win,
        extraResources: (base.win?.extraResources ?? []).filter(keep),
    },
};