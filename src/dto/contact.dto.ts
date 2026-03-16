export interface CreateContactMessageDto {
  name: string;
  email: string;
  phone?: string;
  investmentRange: string;
  propertyType: string;
  message?: string;
}
