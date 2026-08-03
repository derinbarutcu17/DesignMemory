import { Button } from './components/Button';
import { Input } from './components/Input';
import { Card } from './components/Card';
import { Badge } from './components/Badge';

export function App() {
  return (
    <main className="mx-auto max-w-md p-4 space-y-4">
      <Card title="Design Memory Showcase">
        <p className="text-sm text-text">
          Every class below is token-backed. This app is the "clean" side of the demo.
        </p>
      </Card>
      <div className="flex gap-sm">
        <Button>Primary</Button>
        <Badge>v1.0.0</Badge>
      </div>
      <Input label="Email" />
    </main>
  );
}
