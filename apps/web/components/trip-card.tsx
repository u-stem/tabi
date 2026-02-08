import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type TripCardProps = {
  id: string;
  title: string;
  destination: string;
  startDate: string;
  endDate: string;
  status: string;
};

const statusLabels: Record<string, string> = {
  draft: "Draft",
  planned: "Planned",
  active: "Active",
  completed: "Completed",
};

export function TripCard({
  id,
  title,
  destination,
  startDate,
  endDate,
  status,
}: TripCardProps) {
  return (
    <Link href={`/trips/${id}`}>
      <Card className="transition-colors hover:bg-accent/50">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">{title}</CardTitle>
            <Badge variant="secondary">{statusLabels[status] ?? status}</Badge>
          </div>
          <CardDescription>{destination}</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {startDate} - {endDate}
          </p>
        </CardContent>
      </Card>
    </Link>
  );
}
