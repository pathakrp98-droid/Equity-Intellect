import { resolve4 } from "node:dns";
import { isIPv4, Socket, type LookupFunction } from "node:net";

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

type DnsJsonResponse = {
  Status?: unknown;
  Answer?: Array<{ type?: unknown; data?: unknown }>;
};

async function resolveIpv4ViaDnsOverHttps(hostname: string): Promise<string[]> {
  const endpoint = new URL("https://dns.google/resolve");
  endpoint.searchParams.set("name", hostname);
  endpoint.searchParams.set("type", "A");

  const response = await fetch(endpoint, {
    headers: { accept: "application/dns-json" },
    signal: AbortSignal.timeout(5_000),
  });
  if (!response.ok) {
    throw Object.assign(
      new Error(`DNS-over-HTTPS returned HTTP ${response.status}.`),
      { code: "EDNSHTTP" },
    );
  }

  const result = (await response.json()) as DnsJsonResponse;
  if (result.Status !== 0) {
    throw Object.assign(
      new Error(`DNS-over-HTTPS returned status ${String(result.Status)}.`),
      { code: "EDNSSTATUS" },
    );
  }

  return (Array.isArray(result.Answer) ? result.Answer : [])
    .filter(
      (answer) =>
        answer.type === 1 &&
        typeof answer.data === "string" &&
        isIPv4(answer.data),
    )
    .map((answer) => answer.data as string);
}

const dnsOverHttpsResolve4: Resolve4 = (hostname, callback) => {
  void resolveIpv4ViaDnsOverHttps(hostname).then(
    (addresses) => callback(null, addresses),
    (error: unknown) =>
      callback(
        error instanceof Error
          ? (error as NodeJS.ErrnoException)
          : new Error("DNS-over-HTTPS lookup failed."),
        undefined,
      ),
  );
};

function noIpv4AddressError(hostname: string): NodeJS.ErrnoException {
  return Object.assign(new Error(`No IPv4 address found for ${hostname}.`), {
    code: "ENODATA",
  });
}

export function createIpv4DnsLookup(
  resolveHostname: Resolve4 = systemResolve4,
  fallbackResolveHostname: Resolve4 = dnsOverHttpsResolve4,
): LookupFunction {
  return (hostname, options, callback) => {
    const complete = (
      error: NodeJS.ErrnoException | null,
      addresses: string[] | undefined,
    ) => {
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
    };

    resolveHostname(hostname, (error, addresses) => {
      if (error?.code === "EBADNAME") {
        fallbackResolveHostname(hostname, complete);
        return;
      }

      complete(error, addresses);
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
