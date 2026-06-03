import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

export function signAuthToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email
    },
    env.jwtSecret,
    { expiresIn: env.jwtExpiresIn }
  );
}
