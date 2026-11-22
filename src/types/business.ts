export type Language = 'en' | 'ml';

export type AvailabilityState = 'available' | 'unavailable' | 'unknown';

export type FulfillmentType = 'pickup' | 'delivery';

export type OrderCategory = 'regular' | 'bulk_event';

export type OrderStatus =
  | 'Draft'
  | 'Submitted for review'
  | 'Accepted by team'
  | 'Declined or needs follow-up';

export type TeamDecision = 'accepted' | 'needs_followup' | 'rejected';

export interface MenuItem {
  id: string;
  nameEn: string;
  nameMl: string;
  unitEn: string;
  unitMl: string;
  price: number | null;
  priceVerified: boolean;
  availability: AvailabilityState;
  dailyLimit: number | null;
  remainingStock: number | null;
  roleNoteEn: string;
  roleNoteMl: string;
  homeSalesOnly: boolean;
  shopSupplyAllowed: boolean;
  orderAheadOnly: boolean;
  imageUrl: string;
  aliases: string[];
}

export interface BusinessConfig {
  businessName: string;
  businessNameMl: string;
  serviceArea: string;
  openingHours: string;
  openingHoursVerified: boolean;
  deliveryAreaNote: string;
  deliveryRadiusKm: number;
  deliveryAreaVerified: boolean;
  deliveryFee: number | null;
  deliveryFeeVerified: boolean;
  orderCutoff: string;
  orderCutoffVerified: boolean;
  minHomePieces: number;
  minHomeAmount: number;
  minHomeVerified: boolean;
  bulkMinPieces: number;
  bulkMaxPieces: number;
  bulkLeadTime: string;
  bulkAdvancePercent: number;
  bulkAdvanceCollectionEnabled: boolean;
  bulkPolicyVerified: boolean;
  allergenDisclaimerVerified: boolean;
  lastSavedAt: string | null;
  lastSavedBy: string | null;
}

export interface OrderLineItem {
  itemId: string;
  nameEn: string;
  nameMl: string;
  unitEn: string;
  quantity: number;
  unitPrice: number | null;
  lineTotal: number | null;
  availabilityAtOrder: AvailabilityState;
}

export interface OrderDraft {
  customerName: string;
  contact: string;
  items: { itemId: string; quantity: number }[];
  requestedDateTime: string;
  fulfillment: FulfillmentType | null;
  deliveryAddress: string;
  landmark: string;
  orderCategory: OrderCategory;
  language: Language;
  outsideDeliveryAreaFlag: boolean;
  handoffReasons: string[];
  specialNotes: string;
  summaryReviewed: boolean;
}

export interface OrderCalculation {
  lines: OrderLineItem[];
  totalPieces: number;
  subtotal: number | null;
  deliveryFee: number | null;
  total: number | null;
  hasMissingPrice: boolean;
  hasUnverifiedPrice: boolean;
  hasUnavailableOrUnknownItem: boolean;
  meetsMinimumHomeOrder: boolean;
  isBulkOrder: boolean;
  missingFields: string[];
  warnings: string[];
}

export interface SubmittedOrder {
  orderId: string;
  submittedAt: string;
  customerName: string;
  contact: string;
  language: Language;
  items: OrderLineItem[];
  totalPieces: number;
  subtotal: number | null;
  deliveryFee: number | null;
  total: number | null;
  requestedDateTime: string;
  fulfillment: FulfillmentType | null;
  deliveryAddress: string;
  landmark: string;
  orderCategory: OrderCategory;
  bulkAdvanceStatus: string;
  missingDetails: string[];
  handoffReason: string | null;
  status: OrderStatus;
  teamDecision?: TeamDecision;
  teamNotes: string;
  reviewedBy: string;
  isDemoData: boolean;
}

export interface ChatMessage {
  id: string;
  sender: 'customer' | 'assistant';
  text: string;
  language: Language;
  timestamp: string;
  handoffSuggested?: boolean;
  handoffReason?: string | null;
  showSummaryCard?: boolean;
  canSubmitReview?: boolean;
  quickReplies?: { label: string; value: string }[];
}

export interface DailyTrialMetric {
  dayIndex: number;
  dateLabel: string;
  enquiries: number | null;
  submittedRequests: number | null;
  teamAcceptedOrders: number | null;
  repeatCustomers: number | null;
  averageOrderSizeRs: number | null;
  wasteUnsoldPieces: number | null;
  deliveryCostRs: number | null;
  directProfitRs: number | null;
  shopProfitRs: number | null;
  womenPaidHours: number | null;
  womenCount: number | null;
  estimatedEarningsPerWomanRs: number | null;
  ownerNotes: string;
  isDemoData: boolean;
}
