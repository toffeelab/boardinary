import NextAuth from "next-auth";
import authConfig from "./auth.config";

const { auth } = NextAuth(authConfig);

const middleware = auth((req) => {
  const { nextUrl } = req;
  const isLoggedIn = !!req.auth;

  const isAuthRoute = nextUrl.pathname.startsWith("/api/auth");
  const isLoginPage = nextUrl.pathname === "/login";
  const isDashboard = nextUrl.pathname.startsWith("/dashboard");

  if (isAuthRoute) return;

  if (isLoginPage) {
    if (isLoggedIn) {
      return Response.redirect(new URL("/dashboard", nextUrl));
    }
    return;
  }

  if (isDashboard && !isLoggedIn) {
    const callbackUrl = nextUrl.pathname + nextUrl.search;
    return Response.redirect(
      new URL(
        `/login?callbackUrl=${encodeURIComponent(callbackUrl)}`,
        nextUrl,
      ),
    );
  }
});

export default middleware;

export const config = {
  matcher: ["/dashboard/:path*", "/login"],
};
