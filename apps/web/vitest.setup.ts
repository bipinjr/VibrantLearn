import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

// Server-only modules are imported by server actions under test; the guard only matters in Next.
vi.mock("server-only", () => ({}));
