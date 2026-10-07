const target = process.argv[2];
if (target !== process.platform) throw new Error(`Build ${target} installers on ${target}; the bundled PostgreSQL and Prisma binaries must match the target OS.`);
