export {};

declare global {
	interface Window {
		bun: {
			rpc: {
				drawing: {
					getAll(): Promise<any[]>;
					add(data: any): Promise<any>;
					update(data: any): Promise<any>;
					delete(data: { id: number }): Promise<{ success: boolean }>;
				};
			};
		};
	}
}import type { GridColDef } from '@mui/x-data-grid';

declare module '@mui/material/styles' {
  interface Components {
    MuiDataGrid?: {
      styleOverrides?: {
        root?: any;
        columnHeader?: any;
        cell?: any;
        row?: any;
      };
    };
  }
}