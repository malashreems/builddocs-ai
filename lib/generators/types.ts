import type { BoqResult } from "@/lib/boq-engine";

export type GeneratedDocument = {
  name: string;
  fileName: string;
  mimeType: string;
  icon: string;
  data: Blob;
};

export type GeneratorContext = {
  boq: BoqResult;
  startDate: Date;
};

