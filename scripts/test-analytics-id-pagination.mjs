import { randomUUID } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { setTimeout } from 'node:timers/promises'

// Uses only synthetic fixtures; no TCP ports, production DB URL or host DB volume.
// Require the image to be available rather than implicitly downloading it.
const image = 'mysql:8.4.7'
const name = `analytics-upstream-fixture-${randomUUID()}`
const docker = (...args) => spawnSync('docker', args, { encoding: 'utf8', timeout: 30000 })
if (docker('image', 'inspect', image).status !== 0) {
    console.error(`Make ${image} available locally before running this fixture test.`)
    process.exit(1)
}
let created = false
let exitCode = 1
try {
    const start = docker('run', '-d', '--name', name, '--network', 'none',
        '--memory', '768m', '--memory-swap', '768m', '--cpus', '0.5', '--log-driver', 'none',
        '--tmpfs', '/var/lib/mysql:rw,size=384m', '-e', 'MYSQL_ALLOW_EMPTY_PASSWORD=yes',
        image, '--innodb-buffer-pool-size=64M', '--innodb-redo-log-capacity=32M', '--skip-log-bin')
    if (start.status !== 0) throw new Error(start.stderr || 'Fixture start failed')
    created = true
    let ready = false
    for (let attempt = 0; attempt < 90; attempt++) {
        // Do not mistake the entrypoint's temporary initialization server for
        // the final server: initialization shuts down its first mysql process.
        const probe = docker('exec', name, 'sh', '-c', 'read comm < /proc/1/comm; test "$comm" = mysqld && mysql -uroot --batch --skip-column-names -e "SELECT 1"')
        if (probe.status === 0) { ready = true; break }
        await setTimeout(1000)
    }
    if (!ready) throw new Error('Fixture readiness failed')
    const tests = spawnSync('npm', ['run', 'test:run', '--', 'tests/analytics-id-pagination.test.ts', 'tests/analytics-id-pagination-mysql.test.ts'], {
        env: { ...process.env, ANALYTICS_TEST_MYSQL_CONTAINER: name }, stdio: 'inherit', timeout: 150000,
    })
    exitCode = tests.status ?? 1
} catch (error) {
    console.error(error.message)
} finally {
    if (created) {
        const remove = docker('rm', '-f', '-v', name)
        const check = docker('ps', '-a', '--filter', `name=${name}`, '--format', '{{.Names}}')
        const removed = remove.status === 0 && check.status === 0 && check.stdout.trim() === ''
        console.log(`Disposable fixture removed: ${removed}`)
        if (!removed) exitCode = 1
    }
}
process.exitCode = exitCode
