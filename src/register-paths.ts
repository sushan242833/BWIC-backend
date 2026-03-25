import Module from "module";
import path from "path";

const aliasMap = {
  "@models": path.resolve(__dirname, "models"),
  "@config": path.resolve(__dirname, "config"),
  "@constants": path.resolve(__dirname, "constants"),
  "@controller": path.resolve(__dirname, "controller"),
  "@routes": path.resolve(__dirname, "routes"),
  "@utils": path.resolve(__dirname, "utils"),
  "@dto": path.resolve(__dirname, "dto"),
} as const;

const moduleWithPrivateApi = Module as typeof Module & {
  _resolveFilename: (
    request: string,
    parent: NodeModule | null | undefined,
    isMain: boolean,
    options?: Record<string, unknown>,
  ) => string;
};

const originalResolveFilename = moduleWithPrivateApi._resolveFilename;

moduleWithPrivateApi._resolveFilename = function resolveFilename(
  request,
  parent,
  isMain,
  options,
) {
  for (const [alias, targetDirectory] of Object.entries(aliasMap)) {
    if (request === alias || request.startsWith(`${alias}/`)) {
      const aliasSuffix =
        request === alias ? "" : request.slice(alias.length + 1);

      return originalResolveFilename.call(
        this,
        path.join(targetDirectory, aliasSuffix),
        parent,
        isMain,
        options,
      );
    }
  }

  return originalResolveFilename.call(
    this,
    request,
    parent,
    isMain,
    options,
  );
};
