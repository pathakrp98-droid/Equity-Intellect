import { resolve4 } from "node:dns";
import { Socket, type LookupFunction } from "node:net";

export type Resolve4 = (
  hostname: string,
  callback: (
    error: NodeJS.ErrnoException | null,
    addresses: string[] | undefined,
  ) => void,
) => void;

const systemResolve4: Resolve4 = (hostname, callback) => {
  resolve4(hostname, (error, addresses) => callback(error, addresses));
};

function noIpv4AddressError(hostname: string): NodeJS.ErrnoException {
  return Object.assign(new Error(`No IPv4 address found for ${hostname}.`), {
    code: "ENODATA",
  });
}

export function createIpv4DnsLookup(
  resolveHostname: Resolve4 = systemResolve4,
): LookupFunction {
  return (hostname, options, callback) => {
    resolveHostname(hostname, (error, addresses) => {
      if (error) {
        callback(error, options.all ? [] : "", options.all ? undefined : 0);
        return;
      }

      if (!addresses?.length) {
        callback(
          noIpv4AddressError(hostname),
          options.all ? [] : "",
          options.all ? undefined : 0,
        );
        return;
      }

      if (options.all) {
        callback(
          null,
          addresses.map((address) => ({ address, family: 4 })),
        );
        return;
      }

      callback(null, addresses[0], 4);
    });
  };
}

export function createIpv4ResolvedSocket(
  lookup: LookupFunction = createIpv4DnsLookup(),
): Socket {
  const socket = new Socket();
  const connect = socket.connect.bind(socket);

  socket.connect = ((
    portOrOptions: number | Parameters<Socket["connect"]>[0],
    hostOrListener?: string | (() => void),
    listener?: () => void,
  ) => {
    if (typeof portOrOptions === "number") {
      const host =
        typeof hostOrListener === "string" ? hostOrListener : "localhost";
      const onConnect =
        typeof hostOrListener === "function" ? hostOrListener : listener;
      return connect({ port: portOrOptions, host, lookup }, onConnect);
    }

    return connect(
      portOrOptions as Parameters<Socket["connect"]>[0],
      typeof hostOrListener === "function" ? hostOrListener : undefined,
    );
  }) as Socket["connect"];

  return socket;
}

export function shouldUseProtocolDnsResolver(
  connectionString: string,
): boolean {
  try {
    const databaseUrl = new URL(connectionString);
    return (
      (databaseUrl.protocol === "postgres:" ||
        databaseUrl.protocol === "postgresql:") &&
      databaseUrl.hostname.endsWith(".neon.tech")
    );
  } catch {
    return false;
  }
}
