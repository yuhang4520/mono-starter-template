import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export function stringMap(raw, name) {
  const value = JSON.parse(raw || '{}');
  if (!value || Array.isArray(value) || typeof value !== 'object' || Object.values(value).some(v => typeof v !== 'string'))
    throw new Error(`${name} must be a JSON object of string values`);
  return value;
}
const imagePattern = /^[-a-zA-Z0-9._/:]+@sha256:[a-f0-9]{64}$/;
export function migrationJob({ name, namespace, image, secret, pullSecret }) {
  if (!imagePattern.test(image)) throw new Error('Migration image must be pinned by digest');
  return { apiVersion: 'batch/v1', kind: 'Job', metadata: { name, namespace }, spec: {
    backoffLimit: 0, activeDeadlineSeconds: 600, ttlSecondsAfterFinished: 86400,
    template: { metadata: { labels: { job: name } }, spec: {
      restartPolicy: 'Never', ...(pullSecret ? { imagePullSecrets: [{ name: pullSecret }] } : {}),
      securityContext: { runAsNonRoot: true, runAsUser: 1001, fsGroup: 1001, seccompProfile: { type: 'RuntimeDefault' } },
      containers: [{ name: 'migrate', image, env: [{ name: 'DATABASE_URL', valueFrom: { secretKeyRef: { name: secret, key: 'DATABASE_URL' } } }],
        securityContext: { allowPrivilegeEscalation: false, capabilities: { drop: ['ALL'] } },
        resources: { requests: { cpu: '100m', memory: '128Mi' }, limits: { cpu: '1', memory: '512Mi' } } }],
    } },
  } };
}
export function runCommand(command, args, options = {}) {
  const { sensitive = false, ...spawnOptions } = options;
  const result = spawnSync(command, args, { encoding: 'utf8', ...spawnOptions });
  if (result.error) throw result.error;
  // API admission errors can echo the entire submitted Secret, including stringData.
  if (result.status !== 0) throw new Error(`${command} failed (${result.status})${sensitive ? ': sensitive command output suppressed' : `: ${result.stderr || ''}`}`);
  return result.stdout || '';
}
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');

function validateEnvironment(config, secret, component) {
  for (const source of [config, secret]) {
    for (const key of Object.keys(source)) if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) throw new Error(`Invalid ${component} environment variable name`);
  }
  const effective = { ...config, ...secret };
  const parseUrl = key => {
    let url;
    try { url = new URL(effective[key]); } catch { throw new Error(`${component} ${key} must be an HTTP(S) URL`); }
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error(`${component} ${key} must be an HTTP(S) URL without credentials`);
    return url;
  };
  parseUrl('BETTER_AUTH_URL');
  if (component === 'api') {
    parseUrl('AUTH_URL');
    if (!effective.ALLOWED_ORIGINS?.trim()) throw new Error('api ALLOWED_ORIGINS is required');
    for (const value of effective.ALLOWED_ORIGINS.split(',').map(value => value.trim())) {
      let url;
      try { url = new URL(value); } catch { throw new Error('api ALLOWED_ORIGINS must contain exact HTTP(S) origins'); }
      if (!['http:', 'https:'].includes(url.protocol) || url.origin !== value) throw new Error('api ALLOWED_ORIGINS must contain exact HTTP(S) origins');
    }
    if (!effective.S3_BUCKET?.trim()) throw new Error('api S3_BUCKET is required for private attachments');
    if (Boolean(effective.S3_ACCESS_KEY_ID) !== Boolean(effective.S3_SECRET_ACCESS_KEY)) throw new Error('api S3 credentials must be provided together');
    if (effective.S3_ENDPOINT) parseUrl('S3_ENDPOINT');
  }
}

export async function deploy(env = process.env, { run = runCommand, sleep = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds)), now = Date.now } = {}) {
  const namespace = env.K8S_NAMESPACE, name = env.APP_NAME || 'starter';
  for (const value of [namespace, name]) if (!value || !/^[a-z](?:[a-z0-9-]{0,38}[a-z0-9])?$/.test(value)) throw new Error('Namespace/name must be DNS labels (up to 40 characters)');
  if (!env.DATABASE_URL || !env.KUBECONFIG) throw new Error('DATABASE_URL and KUBECONFIG are required');
  const apiSecret = { ...stringMap(env.API_ENV_JSON, 'API_ENV_JSON'), DATABASE_URL: env.DATABASE_URL };
  const adminSecret = { ...stringMap(env.ADMIN_ENV_JSON, 'ADMIN_ENV_JSON'), DATABASE_URL: env.DATABASE_URL };
  for (const [label, value] of [['AUTH_SECRET', apiSecret.AUTH_SECRET], ['API BETTER_AUTH_SECRET', apiSecret.BETTER_AUTH_SECRET], ['Admin BETTER_AUTH_SECRET', adminSecret.BETTER_AUTH_SECRET]]) {
    if (!value || value.length < 32) throw new Error(`${label} must have at least 32 characters`);
  }
  for (const secret of [apiSecret, adminSecret]) {
    for (const key of ['PORT', 'HOSTNAME', 'NODE_ENV']) if (key in secret) throw new Error(`${key} is controlled by the deployment, not Secret JSON`);
  }
  const config = { api: stringMap(env.API_CONFIG_JSON, 'API_CONFIG_JSON'), admin: stringMap(env.ADMIN_CONFIG_JSON, 'ADMIN_CONFIG_JSON') };
  // Do not permit a config map to shadow credentials or runtime listener settings.
  for (const component of ['api', 'admin']) {
    for (const key of Object.keys(config[component])) if (/SECRET|PASSWORD|TOKEN|ACCESS_KEY|DATABASE_URL/.test(key)) throw new Error(`Move ${key} to the component secret JSON`);
  }
  validateEnvironment(config.api, apiSecret, 'api');
  validateEnvironment(config.admin, adminSecret, 'admin');
  const hosts = stringMap(env.K8S_HOSTS_JSON, 'K8S_HOSTS_JSON');
  if (Object.keys(hosts).some(key => !['api','admin'].includes(key))) throw new Error('Ingress supports api/admin hosts only');
  const dnsName = value => value.length > 0 && value.length <= 253 && value.split('.').every(label => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label));
  if (Object.values(hosts).some(host => !dnsName(host))) throw new Error('Ingress hosts must be nonempty DNS hostnames, without scheme, port or wildcard');
  if (new Set(Object.values(hosts)).size !== Object.values(hosts).length) throw new Error('API and Admin must use different Ingress hosts');
  for (const key of ['K8S_IMAGE_PULL_SECRET', 'K8S_TLS_SECRET', 'K8S_INGRESS_CLASS']) {
    if (env[key] && !dnsName(env[key])) throw new Error(`${key} must be a DNS name`);
  }
  const directory = mkdtempSync(join(tmpdir(), 'scaffold-deploy-'));
  const kubectl = (...args) => run('kubectl', ['--namespace', namespace, ...args]);
  try {
    kubectl('get', 'namespace', namespace);
    const plan = JSON.parse(env.DEPLOY_PLAN || '{}');
    if (!plan || typeof plan !== 'object' || Array.isArray(plan) || ['api', 'admin', 'db'].some(key => typeof plan[key] !== 'boolean')) throw new Error('DEPLOY_PLAN must specify boolean api/admin/db flags');
    const image = component => {
      const value = readFileSync(resolve(env.IMAGE_DIRECTORY || 'images', component, 'image.txt'), 'utf8').trim();
      if (!imagePattern.test(value)) throw new Error(`Invalid ${component} image digest`);
      return value;
    };
    // Validate every image before writing cluster state, and preserve unchanged image digests.
    const images = {};
    for (const component of ['api','admin']) {
      images[component] = plan[component] ? image(component) : JSON.parse(kubectl('get', 'deployment', `${name}-${component}`, '-o', 'json')).spec.template.spec.containers[0].image;
      if (!imagePattern.test(images[component])) throw new Error(`Invalid existing ${component} image digest`);
    }
    const migrationImage = plan.db ? image('migration') : undefined;
    if (plan.db) {
      const jobName = `${name}-migrate-${env.GITHUB_RUN_ID}-${env.GITHUB_RUN_ATTEMPT}`;
      if (jobName.length > 63 || !/^[a-z0-9-]+$/.test(jobName)) throw new Error('Invalid migration job name');
      // An isolated temporary Secret cannot change the environment of existing application pods.
      const migrationSecret = { apiVersion: 'v1', kind: 'Secret', metadata: { name: jobName, namespace }, type: 'Opaque', stringData: { DATABASE_URL: env.DATABASE_URL } };
      let migrationError;
      try {
        run('kubectl', ['apply', '-f', '-'], { input: JSON.stringify(migrationSecret), sensitive: true });
        run('kubectl', ['apply', '-f', '-'], { input: JSON.stringify(migrationJob({ name: jobName, namespace, image: migrationImage, secret: jobName, pullSecret: env.K8S_IMAGE_PULL_SECRET })) });
        const deadline = now() + 620_000;
        let complete = false;
        while (now() < deadline) {
          const status = JSON.parse(kubectl('get', 'job', jobName, '-o', 'json')).status || {};
          if (status.succeeded) { complete = true; break; }
          if (status.failed || status.conditions?.some(c => c.type === 'Failed' && c.status === 'True')) break;
          await sleep(3000);
        }
        if (!complete) throw new Error('Migration did not succeed; application rollout is blocked');
      } catch (error) {
        migrationError = error;
        try { run('kubectl', ['--namespace', namespace, 'logs', `job/${jobName}`, '--all-containers', '--tail=100'], { stdio: 'inherit' }); }
        catch { console.warn('Migration logs are unavailable; preserving the original deployment failure'); }
        throw error;
      } finally {
        // Even a failed Job submission or status request must not leave database credentials behind.
        try { kubectl('delete', 'secret', jobName, '--ignore-not-found'); }
        catch (error) {
          if (!migrationError) throw error;
          console.warn('Temporary migration Secret cleanup failed; remove it manually');
        }
      }
    }
    const secrets = { api: apiSecret, admin: adminSecret };
    for (const component of ['api','admin']) {
      const manifest = { apiVersion: 'v1', kind: 'Secret', metadata: { name: `${name}-${component}`, namespace }, type: 'Opaque', stringData: secrets[component] };
      run('kubectl', ['apply', '-f', '-'], { input: JSON.stringify(manifest), sensitive: true });
    }
    const vars = { kubeconfig: env.KUBECONFIG, namespace, name, images, config,
      secret_revisions: { api: digest(apiSecret), admin: digest(adminSecret) }, image_pull_secret: env.K8S_IMAGE_PULL_SECRET || '',
      hosts, ingress_class: env.K8S_INGRESS_CLASS || 'nginx', tls_secret: env.K8S_TLS_SECRET || '' };
    const varsFile = join(directory, 'variables.json');
    writeFileSync(varsFile, JSON.stringify(vars), { mode: 0o600 });
    const tf = (...args) => run('terraform', ['-chdir=infra/k8s', ...args], { stdio: 'inherit' });
    let initialized = false;
    for (let attempt = 0; attempt < 3; attempt++) {
      try { tf('init', '-input=false', `-backend-config=config_path=${env.KUBECONFIG}`, `-backend-config=namespace=${namespace}`, `-backend-config=secret_suffix=${name}`); initialized = true; break; }
      catch (error) { if (attempt === 2) throw error; await sleep((attempt + 1) * 5000); }
    }
    if (!initialized) throw new Error('Terraform initialization failed');
    tf('apply', '-input=false', '-auto-approve', `-var-file=${varsFile}`);
    for (const component of ['api','admin']) kubectl('rollout', 'status', `deployment/${name}-${component}`, '--timeout=300s');
  } finally { rmSync(directory, { recursive: true, force: true }); }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) deploy().catch(error => { console.error(error.message); process.exitCode = 1; });
