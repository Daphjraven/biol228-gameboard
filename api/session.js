export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { sessionName, payload } = req.body || {};

    if (!sessionName || !payload) {
      return res.status(400).json({ error: "Missing sessionName or payload" });
    }

    const owner = process.env.GITHUB_OWNER;
    const repo = process.env.GITHUB_REPO;
    const branch = process.env.GITHUB_BRANCH || "main";
    const folder = process.env.GITHUB_SESSIONS_FOLDER || "sessions";
    const token = process.env.GITHUB_TOKEN;

    if (!owner || !repo || !token) {
      return res.status(500).json({ error: "Missing GitHub environment variables" });
    }

    const safeName = String(sessionName)
      .trim()
      .toLowerCase()
      .replace(/\.json$/i, "")
      .replace(/[^a-z0-9-_]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "") || "board-session";

    const path = `${folder}/${safeName}.json`;
    const apiPath = path.split("/").map(encodeURIComponent).join("/");
    const githubUrl = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${apiPath}`;

    let sha = null;

    const existingRes = await fetch(`${githubUrl}?ref=${encodeURIComponent(branch)}`, {
      headers: {
        "Accept": "application/vnd.github+json",
        "Authorization": `Bearer ${token}`,
        "X-GitHub-Api-Version": "2022-11-28"
      }
    });

    if (existingRes.ok) {
      const existingData = await existingRes.json();
      sha = existingData.sha || null;
    } else if (existingRes.status !== 404) {
      const text = await existingRes.text();
      return res.status(500).json({ error: `Failed checking existing file: ${text}` });
    }

    const content = Buffer.from(
      JSON.stringify(payload, null, 2),
      "utf8"
    ).toString("base64");

    const body = {
      message: `Save board session ${safeName}`,
      content,
      branch
    };

    if (sha) {
      body.sha = sha;
    }

    const saveRes = await fetch(githubUrl, {
      method: "PUT",
      headers: {
        "Accept": "application/vnd.github+json",
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
        "X-GitHub-Api-Version": "2022-11-28"
      },
      body: JSON.stringify(body)
    });

    if (!saveRes.ok) {
      const text = await saveRes.text();
      return res.status(500).json({ error: `GitHub save failed: ${text}` });
    }

    const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${path}`;

    return res.status(200).json({
      ok: true,
      sessionName: safeName,
      path,
      rawUrl
    });
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Unknown server error"
    });
  }
}
