import { AuthUserDto } from "@dto/auth.dto";

declare global {
  namespace Express {
    interface Request {
      user?: AuthUserDto;
    }
  }
}

export {};
