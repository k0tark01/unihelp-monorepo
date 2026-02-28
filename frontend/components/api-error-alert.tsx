import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

type ApiErrorAlertProps = {
  message: string;
};

export function ApiErrorAlert({ message }: ApiErrorAlertProps) {
  return (
    <Alert variant="destructive">
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>API Error</AlertTitle>
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );
}