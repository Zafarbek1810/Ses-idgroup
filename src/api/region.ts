import { apiRequest } from "./client";

export type District = {
  id: number;
  name: string;
  createdAt: string;
};

export type Region = {
  id: number;
  name: string;
  createdAt: string;
  district: District[];
};

export function getAllRegions() {
  return apiRequest<Region[]>("/region/getallregion", {
    method: "GET",
    fallbackError: "Viloyatlarni yuklab bo'lmadi",
  });
}
