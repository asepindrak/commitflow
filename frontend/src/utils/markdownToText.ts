const markdownToText = (md: string) => {
    if (!md) return '';

    let text = md;

    // Hapus kode blok ```...```
    text = text.replace(/```[\s\S]*?```/g, '');

    // Hapus inline code `...`
    text = text.replace(/`([^`]+)`/g, '$1');

    // Hapus bold/italic **...**, __...__, *, _
    text = text.replace(/(\*\*|__)(.*?)\1/g, '$2');
    text = text.replace(/(\*|_)(.*?)\1/g, '$2');

    // Hapus heading #, ##, ###, dst.
    text = text.replace(/^\s*#{1,6}\s*/gm, '');

    // Hapus list bullet -, *, +
    text = text.replace(/^\s*[-*+]\s+/gm, '');

    // Hapus link [text](url) → jadi text
    text = text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');

    // Hapus emoji Markdown :smile:
    text = text.replace(/:[a-z_]+:/g, '');

    // Hapus karakter sisa asterisk atau underscore tunggal di awal/akhir kata
    text = text.replace(/(^\*+|\*+$)/g, '');
    text = text.replace(/(^_+|_+$)/g, '');

    // Ganti newline ganda dengan 1 spasi
    text = text.replace(/\n+/g, ' ').trim();

    return text;
};



export { markdownToText }