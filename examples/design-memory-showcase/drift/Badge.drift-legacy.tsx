// Drift: importing from the deprecated component path.
import { Badge } from './legacy/Badge';

export function Status({ children }: { children: React.ReactNode }) {
  return <Badge>{children}</Badge>;
}
