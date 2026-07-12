import { UserProfile } from './types';

/**
 * Checks whether a user has a specific permission.
 * Respects explicit overrides in UserProfile, with fallback to default role permissions.
 */
export function hasPermission(user: UserProfile | null | undefined, permission: 'canCreateWR' | 'canCreateWO' | 'canDeleteWR' | 'canDeleteWO' | 'canApprove' | 'canReject' | 'canAssignTeknisi' | 'canPlayWork' | 'canFinishWork' | 'canInputSAP' | 'canEditExistingSAP' | 'canManagePMAssets' | 'canInputPMReading' | 'canDeleteInventory' | 'canAdjustInventory' | 'canShowTabAssets' | 'canShowTabReports' | 'canShowTabInventory'): boolean {
  if (!user) return false;
  
  // Administrator has all permissions by default
  if (user.role === 'admin') {
    // If explicitly set to false, respect it, otherwise default to true for admin
    if (user[permission] === false) return false;
    return true;
  }

  // If the permission is explicitly configured (true/false) in the database, use it
  if (user[permission] !== undefined) {
    return !!user[permission];
  }

  // Fallback to role-based default permissions
  switch (permission) {
    case 'canCreateWR':
      // MTC Management and User Departement (Admin already handled above)
      return user.role === 'management' || user.role === 'departemen';
    
    case 'canCreateWO':
      // MTC Management
      return user.role === 'management';
    
    case 'canDeleteWR':
    case 'canDeleteWO':
    case 'canApprove':
    case 'canReject':
    case 'canAssignTeknisi':
      // Management can do these by default
      return user.role === 'management';

    case 'canInputSAP':
      // Management/Admin can edit SAP by default
      return user.role === 'management';

    case 'canEditExistingSAP':
      // By default, only admin can edit existing SAP, management can have it if granted
      return false;

    case 'canPlayWork':
    case 'canFinishWork':
      // Technicians can do these by default
      return user.role === 'teknisi';

    case 'canManagePMAssets':
      // By default, only admin/management can manage PM assets
      return user.role === 'management';

    case 'canInputPMReading':
      // By default, admin, management and technicians can input PM readings
      return user.role === 'management' || user.role === 'teknisi';

    case 'canDeleteInventory':
      // By default, admin and management can delete inventory items
      return user.role === 'management';

    case 'canShowTabAssets':
    case 'canShowTabReports':
    case 'canShowTabInventory':
      // By default, all roles can see assets, reports, inventory tabs
      return true;
    
    default:
      return false;
  }
}

/**
 * Exports data arrays to an Excel-friendly CSV file with UTF-8 BOM.
 */
export function exportToExcelCSV(data: any[], headers: string[], keys: string[], filename: string) {
  const escapeCsvField = (val: any) => {
    if (val === null || val === undefined) return '';
    let str = String(val);
    str = str.replace(/"/g, '""');
    if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
      return `"${str}"`;
    }
    return str;
  };

  const csvRows: string[] = [];
  
  // Headers row
  csvRows.push(headers.map(escapeCsvField).join(','));
  
  // Data rows
  for (const item of data) {
    const row = keys.map(key => {
      // Support nested properties
      const parts = key.split('.');
      let val = item;
      for (const part of parts) {
        if (val !== undefined && val !== null) {
          val = val[part];
        } else {
          val = '';
          break;
        }
      }
      
      // Special formatting for arrays e.g. teknisiDitugaskan
      if (Array.isArray(val)) {
        return escapeCsvField(val.join(', '));
      }
      
      return escapeCsvField(val);
    });
    csvRows.push(row.join(','));
  }
  
  // Add UTF-8 BOM so Excel opens it with correct layout and characters
  const csvContent = '\uFEFF' + csvRows.join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Formats a date string/timestamp (ISO or locale string) to "DD/MM/YYYY, HH:mm:ss"
 */
export function formatDateTime(dateStr?: string | null): string {
  if (!dateStr) return '-';
  try {
    // If we can parse it as a valid date timestamp
    const parsed = Date.parse(dateStr);
    if (!isNaN(parsed)) {
      const d = new Date(parsed);
      return d.toLocaleString('id-ID', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      }).replace(/\./g, ':');
    }
    
    // Fallback if parsing failed but it's already a formatted string from old records
    return dateStr;
  } catch (e) {
    return dateStr || '-';
  }
}


