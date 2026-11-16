import { authRouter } from "./routers/auth";
import { workspaceRouter } from "./routers/workspace";
import { router } from "./trpc";
import { identityTransformer } from "./lib/identityTransformer";

export const appRouter = router({
  auth: authRouter,
  workspace: workspaceRouter,
});

export type AppRouter = typeof appRouter;
export * from "./types/user";
export { identityTransformer };
