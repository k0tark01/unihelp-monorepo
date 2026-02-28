import { EmailGeneratorClient } from "@/components/email-generator-client";

type EmailPageProps = {
  searchParams?: {
    templateKey?: string;
  };
};

export default function EmailPage({ searchParams }: EmailPageProps) {
  return <EmailGeneratorClient templateKey={searchParams?.templateKey} />;
}