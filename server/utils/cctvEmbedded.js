const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');
const { generateMediamtxConfig } = require('./cctvAccessHelper');

let childProcess = null;
let lastError = null;
let lastSpawnAt = 0;
let stopRequested = false;
let shutdownHookRegistered = false;

const findMediamtxBinary = () => {
    const candidates = [
        process.env.MEDIAMTX_BIN,
        '/usr/local/bin/mediamtx',
        '/mediamtx',
        path.join(__dirname, '../bin', process.platform === 'win32' ? 'mediamtx.exe' : 'mediamtx')
    ].filter(Boolean);

    for (const filePath of candidates) {
        try {
            if (fs.existsSync(filePath)) return filePath;
        } catch {
            // ignore stat error
        }
    }
    return null;
};

const isEmbeddedRunning = () => Boolean(childProcess && !childProcess.killed && childProcess.exitCode === null);

const getEmbeddedStatus = () => {
    const binPath = findMediamtxBinary();
    return {
        available: Boolean(binPath),
        running: isEmbeddedRunning(),
        pid: childProcess?.pid || null,
        lastError
    };
};

const stopEmbeddedMediamtx = () => {
    stopRequested = true;
    if (childProcess && !childProcess.killed) {
        try {
            childProcess.kill('SIGTERM');
        } catch {
            // ignore
        }
    }
};

const registerShutdownHooks = () => {
    if (shutdownHookRegistered) return;
    shutdownHookRegistered = true;
    process.once('SIGTERM', stopEmbeddedMediamtx);
    process.once('SIGINT', stopEmbeddedMediamtx);
};

/**
 * Mengubah alamat bind ke 127.0.0.1 agar MediaMTX tertanam hanya dapat diakses oleh proses backend Node.js.
 */
const buildLocalRuntimeYaml = (cameras, username, password) => {
    const baseYaml = generateMediamtxConfig(cameras, { username, password });
    return baseYaml
        .replace('apiAddress: :9997', 'apiAddress: 127.0.0.1:9997')
        .replace('webrtcAddress: :8889', 'webrtcAddress: 127.0.0.1:8889')
        .replace('hlsAddress: :8888', 'hlsAddress: 127.0.0.1:8888');
};

/**
 * Memastikan MediaMTX tertanam (jika binary tersedia di container) menyala dan
 * CctvGateway terisi default localhost apabila belum ada konfigurasi eksternal.
 */
const ensureEmbeddedGateway = async (prisma) => {
    const binPath = findMediamtxBinary();
    if (!binPath) {
        return { started: false, available: false };
    }

    registerShutdownHooks();
    stopRequested = false;

    let row = await prisma.cctvGateway.findUnique({ where: { id: 1 } }).catch(() => null);
    const hasCustomExternal = Boolean(
        row &&
        ((row.apiUrl && !row.apiUrl.includes('127.0.0.1')) ||
            (row.hlsUrl && !row.hlsUrl.includes('127.0.0.1')) ||
            (row.webrtcUrl && !row.webrtcUrl.includes('127.0.0.1')))
    );

    if (hasCustomExternal) {
        return { started: false, available: true, skippedReason: 'Menggunakan gateway eksternal' };
    }

    const gwUsername = row?.username || 'sarpras_internal';
    const gwPassword = row?.password || crypto.randomBytes(16).toString('hex');

    if (!row || !row.apiUrl || !row.hlsUrl || !row.password) {
        row = await prisma.cctvGateway.upsert({
            where: { id: 1 },
            update: {
                webrtcUrl: row?.webrtcUrl || 'http://127.0.0.1:8889',
                hlsUrl: row?.hlsUrl || 'http://127.0.0.1:8888',
                apiUrl: row?.apiUrl || 'http://127.0.0.1:9997',
                username: gwUsername,
                password: gwPassword
            },
            create: {
                id: 1,
                webrtcUrl: 'http://127.0.0.1:8889',
                hlsUrl: 'http://127.0.0.1:8888',
                apiUrl: 'http://127.0.0.1:9997',
                username: gwUsername,
                password: gwPassword
            }
        });
    }

    if (isEmbeddedRunning()) {
        return { started: true, available: true, alreadyRunning: true };
    }

    const now = Date.now();
    if (now - lastSpawnAt < 5000) {
        return { started: false, available: true, cooldown: true };
    }
    lastSpawnAt = now;

    const cameras = await prisma.cctvCamera.findMany({
        where: { isActive: true },
        include: { unit: { select: { id: true, name: true, code: true } } },
        orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }]
    }).catch(() => []);

    const runtimeConfigPath = path.join(os.tmpdir(), 'sarpras-mediamtx.yml');
    const yamlContent = buildLocalRuntimeYaml(cameras, gwUsername, gwPassword);
    fs.writeFileSync(runtimeConfigPath, yamlContent, 'utf8');

    lastError = null;
    const proc = spawn(binPath, [runtimeConfigPath], {
        stdio: ['ignore', 'pipe', 'pipe']
    });
    childProcess = proc;

    const captureLog = (chunk) => {
        const line = chunk.toString().trim().split('\n').pop();
        if (line && /err|fatal|panic/i.test(line)) {
            lastError = line.slice(0, 300);
        }
    };
    proc.stdout?.on('data', captureLog);
    proc.stderr?.on('data', captureLog);

    proc.on('error', (err) => {
        lastError = err.message;
        if (childProcess === proc) childProcess = null;
    });

    proc.on('exit', (code) => {
        if (childProcess === proc) childProcess = null;
        if (!stopRequested && code !== 0) {
            lastError = lastError || `MediaMTX berhenti dengan kode ${code}`;
            console.error('[CCTV Embedded MediaMTX] exited:', lastError);
            setTimeout(() => {
                if (!stopRequested) ensureEmbeddedGateway(prisma).catch(() => null);
            }, 6000);
        }
    });

    console.log(`[CCTV] Embedded MediaMTX started (PID: ${proc.pid})`);
    return { started: true, available: true, pid: proc.pid };
};

module.exports = {
    findMediamtxBinary,
    getEmbeddedStatus,
    ensureEmbeddedGateway,
    stopEmbeddedMediamtx
};
