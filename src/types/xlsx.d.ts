declare module 'xlsx' {
  export interface WorkBook {
    Sheets: { [sheet: string]: WorkSheet };
    SheetNames: string[];
    Props?: any;
  }

  export interface WorkSheet {
    [key: string]: CellObject | any;
    '!ref'?: string;
    '!merges'?: any[];
    '!cols'?: any[];
    '!rows'?: any[];
  }

  export interface CellObject {
    v?: any;
    w?: string;
    t?: string;
    f?: string;
    r?: string;
    h?: string;
    s?: any;
    z?: any;
  }

  export interface CellStyle {
    fill?: {
      patternType?: string;
      fgColor?: { rgb?: string };
    };
    font?: {
      color?: { rgb?: string };
      bold?: boolean;
      sz?: number;
      name?: string;
    };
    alignment?: {
      horizontal?: string;
      vertical?: string;
      wrapText?: boolean;
    };
    border?: {
      top?: { style?: string; color?: { rgb?: string } };
      bottom?: { style?: string; color?: { rgb?: string } };
      left?: { style?: string; color?: { rgb?: string } };
      right?: { style?: string; color?: { rgb?: string } };
    };
    numFmt?: string;
  }

  export function book_new(): WorkBook;
  export function book_append_sheet(wb: WorkBook, ws: WorkSheet, name: string): void;
  export function aoa_to_sheet(data: any[][]): WorkSheet;
  export function json_to_sheet(data: any[]): WorkSheet;
  export function sheet_add_aoa(ws: WorkSheet, data: any[][], opts?: { origin?: string | number }): void;
  export function sheet_add_json(ws: WorkSheet, data: any[], opts?: { origin?: string | number }): void;
  export function decode_range(ref: string): { s: { r: number; c: number }; e: { r: number; c: number } };
  export function encode_cell(cell: { r: number; c: number }): string;
  
  export const utils: {
    book_new: typeof book_new;
    book_append_sheet: typeof book_append_sheet;
    aoa_to_sheet: typeof aoa_to_sheet;
    json_to_sheet: typeof json_to_sheet;
    sheet_add_aoa: typeof sheet_add_aoa;
    sheet_add_json: typeof sheet_add_json;
    decode_range: typeof decode_range;
    encode_cell: typeof encode_cell;
  };

  export function write(wb: WorkBook, opts: { bookType: string; type: string }): any;
  export function writeFile(wb: WorkBook, filename: string, opts?: any): void;
  
  export const version: string;
}
