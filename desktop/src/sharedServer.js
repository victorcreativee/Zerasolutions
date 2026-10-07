import { X509Certificate } from 'node:crypto';
import { createSecureContext } from 'node:tls';
import { isIP } from 'node:net';

export function validateSharedServer(settings) {
  if (!settings?.enabled) return null;
  let url;
  try { url = new URL(settings.address); } catch { throw new Error('Enter the HTTPS address for this server.'); }
  const port = Number(url.port || 443);
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.pathname !== '/' || port < 1024 || port > 65535) throw new Error('Use an HTTPS server address with a port from 1024 to 65535, for example https://shop.example.com:5443.');
  const certificate = new X509Certificate(settings.cert);
  const hostname = url.hostname.replace(/^\[|\]$/g,'');
  if (!(isIP(hostname) ? certificate.checkIP(hostname) : certificate.checkHost(hostname)) || Date.parse(certificate.validTo) <= Date.now() || Date.parse(certificate.validFrom) > Date.now()) throw new Error('The TLS certificate must be valid and match the server address.');
  createSecureContext({cert:settings.cert,key:settings.key,minVersion:'TLSv1.2'});
  return {...settings,port,address:url.origin};
}
