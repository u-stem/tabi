import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { STATUS_LABELS } from "@tabi/shared";
import { formatDateRange, getDayCount } from "@/lib/format";

type TripCardProps = {
  id: string;
  title: string;
  destination: string;
  startDate: string;
  endDate: string;
  status: string;
};

export function TripCard({
  id,
  title,
  destination,
  startDate,
  endDate,
  status,
}: TripCardProps) {
  const dayCount = getDayCount(startDate, endDate);

  return (
    <Link
      href={`/trips/${id}`}
      className="block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      <Card className="transition-colors hover:bg-accent/50">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">{title}</CardTitle>
            <Badge variant="secondary">
              {STATUS_LABELS[status as keyof typeof STATUS_LABELS] ?? status}
            </Badge>
          </div>
          <CardDescription>{destination}</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {formatDateRange(startDate, endDate)}
            <span className="ml-2">({dayCount}日間)</span>
          </p>
        </CardContent>
      </Card>
    </Link>
  );
}
