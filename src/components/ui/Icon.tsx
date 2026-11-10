/* eslint-disable */
// @ts-nocheck
import {
  House, CalendarDays, ClipboardList, Building2, Users, CircleDollarSign, Tag, LogIn, LogOut, Pencil, Trash2,
  MessageCircle, FileText, TriangleAlert, X, Check, CircleCheck, Plus, Calculator, Sun, Repeat, History, Moon,
  Package, Megaphone, Eye, Sparkles, Coffee, Zap, ThumbsUp, Droplet, Smile, Calendar, BedDouble, Key, KeyRound,
  ArrowUpRight, ArrowDownLeft, User, Circle, ChevronRight, ChevronLeft, Link, Cake, Clock, Camera, Gift, Bell, Shuffle, Wallet,
  Briefcase, Star, Receipt, Target, CreditCard, Search, WandSparkles, ChartColumn, Inbox, Banknote,
} from 'lucide-react';

// ── ÍCONOS ────────────────────────────────────────────────────────────────────
// Misma familia que Itzé Limpieza (Lucide: línea de 2, puntas redondeadas). Uso: <Icon name="cake" size={18} />.
// El color sale del texto que lo rodea (currentColor) salvo que se pase `color`.
// Para sumar uno: elegirlo en lucide.dev, importarlo arriba y darle un nombre acá.
// Los emojis quedan solo en mensajes para el huésped (WhatsApp, cumpleaños), no en botones ni títulos.
const ICONS = {
  // menú
  home: House,
  calendar: CalendarDays,
  list: ClipboardList,
  building: Building2,
  users: Users,
  finance: CircleDollarSign,
  tag: Tag,
  // reservas
  checkIn: LogIn,
  checkOut: LogOut,
  edit: Pencil,
  trash: Trash2,
  whatsapp: MessageCircle,
  invoice: FileText,
  warning: TriangleAlert,
  close: X,
  tick: Check,
  check: CircleCheck,
  plus: Plus,
  calculator: Calculator,
  link: Link,
  cake: Cake,
  clock: Clock,
  camera: Camera,
  gift: Gift,
  bell: Bell,
  shuffle: Shuffle,
  wallet: Wallet,
  money: Banknote,
  card: CreditCard,
  company: Briefcase,
  star: Star,
  receipt: Receipt,
  target: Target,
  search: Search,
  wand: WandSparkles,
  chart: ChartColumn,
  inbox: Inbox,
  key: Key,
  pin: KeyRound,
  user: User,
  bed: BedDouble,
  // los de Itzé Limpieza
  sun: Sun,
  repeat: Repeat,
  history: History,
  moon: Moon,
  package: Package,
  megaphone: Megaphone,
  eye: Eye,
  sparkles: Sparkles,
  coffee: Coffee,
  zap: Zap,
  thumb: ThumbsUp,
  drop: Droplet,
  smile: Smile,
  cal: Calendar,
  rout: ArrowUpRight,
  rin: ArrowDownLeft,
  circle: Circle,
  chev: ChevronRight,
  chevL: ChevronLeft,
};

export const Icon = ({ name, size = 20, color = 'currentColor', strokeWidth = 2, style = undefined }) => {
  const C = ICONS[name];
  if (!C) return null;
  return <C size={size} color={color} strokeWidth={strokeWidth} style={{ flexShrink: 0, ...style }} aria-hidden="true" />;
};

// Ícono dentro de un texto (botones, títulos, avisos): alineado con la letra y con un espacio a la derecha.
// Uso: <span>{ic('camera')}Foto frente</span>
export const ic = (name, size = 15, style = undefined) => (
  <Icon name={name} size={size} style={{ verticalAlign: '-0.18em', marginRight: 5, ...style }} />
);
