export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const owner = process.env.GITHUB_OWNER;
    const repo = process.env.GITHUB_REPO;
    const branch = process.env.GITHUB_BRANCH || "main";
    const folder = process.env.GITHUB_SESSIONS_FOLDER || "sessions";
    const token = process.env.GITHUB_TOKEN;

    if (!owner || !repo || !token) {
      return res.status(500).json({ error: "Missing GitHub environment variables" });
    }

    const apiPath = folder.split("/").map(encodeURIComponent).join("/");
    const githubUrl = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${apiPath}?ref=${encodeURIComponent(branch)}`;

    const githubRes = await fetch(githubUrl, {
      headers: {
        "Accept": "application/vnd.github+json",
        "Authorization": `Bearer ${token}`,
        "X-GitHub-Api-Version": "2022-11-28"
      }
    });

    if (!githubRes.ok) {
      const text = await githubRes.text();
      return res.status(500).json({ error: `Failed listing sessions: ${text}` });
    }

    const items = await githubRes.json();

    const boards = (Array.isArray(items) ? items : [])
      .filter((item) => item.type === "file" && item.name.endsWith(".json"))
      .map((item) => ({
        name: item.name.replace(/\.json$/i, ""),
        label: item.name.replace(/\.json$/i, ""),
        url: `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${folder}/${item.name}`
      }));

    return res.status(200).json({ items: boards });
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Unknown server error"
    });
  }
}
