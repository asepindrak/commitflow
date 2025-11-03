// src/github.ts
import axios from "axios";
import "dotenv/config";
import logger from "vico-logger";


const headers = {
    Accept: "application/vnd.github.v3+json",
    Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
};

export async function getContributors(repo: string, retries = 3) {
    const owner = process.env.GITHUB_OWNER;
    const url = `https://api.github.com/repos/${owner}/${repo}/stats/contributors`;

    try {
        console.log("getContributors", repo);

        for (let attempt = 1; attempt <= retries; attempt++) {
            const res = await axios.get(url, { headers });

            if (res.status === 200 && Array.isArray(res.data)) {
                return res.data.map((c: any) => ({
                    username: c.author.login,
                    avatarUrl: c.author.avatar_url,
                    profileUrl: c.author.html_url,
                    totalCommits: c.total,
                    linesAdded: c.weeks.reduce((a: number, w: any) => a + w.a, 0),
                    linesDeleted: c.weeks.reduce((a: number, w: any) => a + w.d, 0),
                }));
            }

            if (res.status === 202) {
                console.log(`Stats for ${owner}/${repo} are not ready yet. Retrying (${attempt}/${retries})...`);
                await new Promise((r) => setTimeout(r, 5000)); // tunggu 5 detik
                continue;
            }

            if (res.status === 404) {
                console.log(`Repository ${owner}/${repo} not found or stats not available.`);
                return [];
            }

            console.log("Unexpected response:", res.status, res.data);
            return [];
        }

        console.log(`Stats for ${owner}/${repo} still not ready after ${retries} retries.`);
        return [];

    } catch (error) {
        logger.error("error fetching contributors", error);
        return [];
    }
}

// =================== FETCH REPOS WITH RETRY ===================
export async function getRepos(retries = 3) {
    const owner = process.env.GITHUB_OWNER;
    console.log("getRepos", owner);

    const allRepos: any[] = [];
    let page = 1;
    const perPage = 100;

    while (true) {
        const url = `https://api.github.com/orgs/${owner}/repos?per_page=${perPage}&page=${page}`;

        let success = false;
        for (let attempt = 1; attempt <= retries; attempt++) {
            try {
                const res = await axios.get(url, { headers });

                if (Array.isArray(res.data) && res.data.length > 0) {
                    allRepos.push(...res.data);
                    success = true;
                    break; // keluar dari retry loop
                } else if (res.data.length === 0) {
                    success = true; // tidak ada repo lagi
                    break;
                }
            } catch (err) {
                console.log(`Error fetching page ${page}, attempt ${attempt}/${retries}:`, err.message);
                if (attempt < retries) {
                    await new Promise((r) => setTimeout(r, 3000)); // tunggu 3 detik sebelum retry
                }
            }
        }

        if (!success) {
            console.log(`Failed to fetch page ${page} after ${retries} retries. Stopping.`);
            break;
        }

        if (allRepos.length < page * perPage) {
            break; // tidak ada repos lagi
        }

        page++;
    }

    const repos = allRepos.map((r: any) => ({
        owner: owner,
        name: r.name,
        fullName: r.full_name,
        description: r.description,
        stars: r.stargazers_count,
        forks: r.forks_count,
        updatedAt: r.updated_at,
    }));

    console.log(`Fetched ${repos.length} repos from GitHub`);
    return repos;
}

