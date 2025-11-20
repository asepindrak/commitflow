const messagePlaceholders: string[] = [
    // 🔹 Analisis Saham
    'daftar repo',
    'daftar kontributor di repo commitflow',
    'siapa yang paling banyak berkontribusi di repo commitflow?',
];


function getRandomPlaceholder(): string {
    const index = Math.floor(Math.random() * messagePlaceholders.length);
    return messagePlaceholders[index];
}
export { getRandomPlaceholder }