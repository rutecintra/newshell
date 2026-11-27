const branch = process.env.VERCEL_GIT_COMMIT_REF || "";
if (!branch || branch === "main") process.exit(1);
process.exit(0);
