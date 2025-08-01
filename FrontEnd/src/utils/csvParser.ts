export interface CSVParseResult {
  data: Record<string, string>[];
  headers: string[];
  errors: string[];
}

export const parseCSV = (file: File): Promise<CSVParseResult> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (event) => {
      try {
        const csvText = event.target?.result as string;
        const result = parseCSVText(csvText);
        resolve(result);
      } catch (error) {
        reject(error);
      }
    };
    
    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };
    
    reader.readAsText(file);
  });
};

export const parseCSVText = (csvText: string): CSVParseResult => {
  const lines = csvText.split('\n').map(line => line.trim()).filter(line => line);
  const errors: string[] = [];
  
  if (lines.length === 0) {
    return { data: [], headers: [], errors: ['File is empty'] };
  }
  
  // Parse header row
  const headers = parseCSVRow(lines[0]);
  
  if (headers.length === 0) {
    return { data: [], headers: [], errors: ['No headers found in CSV'] };
  }
  
  // Validate required headers
  const requiredHeaders = ['name', 'phoneNumber'];
  const missingHeaders = requiredHeaders.filter(header => 
    !headers.some(h => h.toLowerCase().includes(header.toLowerCase()))
  );
  
  if (missingHeaders.length > 0) {
    errors.push(`Missing required columns: ${missingHeaders.join(', ')}`);
  }
  
  // Parse data rows
  const data: Record<string, string>[] = [];
  
  for (let i = 1; i < lines.length; i++) {
    const row = parseCSVRow(lines[i]);
    
    if (row.length === 0) continue; // Skip empty rows
    
    if (row.length !== headers.length) {
      errors.push(`Row ${i + 1}: Expected ${headers.length} columns, got ${row.length}`);
      continue;
    }
    
    const rowData: Record<string, string> = {};
    headers.forEach((header, index) => {
      rowData[header] = row[index] || '';
    });
    
    data.push(rowData);
  }
  
  return { data, headers, errors };
};

const parseCSVRow = (row: string): string[] => {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  let i = 0;
  
  while (i < row.length) {
    const char = row[i];
    
    if (char === '"') {
      if (inQuotes && row[i + 1] === '"') {
        // Escaped quote
        current += '"';
        i += 2;
      } else {
        // Start or end of quoted field
        inQuotes = !inQuotes;
        i++;
      }
    } else if (char === ',' && !inQuotes) {
      // Field separator
      result.push(current.trim());
      current = '';
      i++;
    } else {
      current += char;
      i++;
    }
  }
  
  // Add the last field
  result.push(current.trim());
  
  return result;
};

export const generateCSVTemplate = (): string => {
  const headers = ['name', 'phoneNumber', 'email', 'position', 'company'];
  const sampleData = [
    ['John Doe', '+919876543210', 'john@example.com', 'Software Developer', 'TechCorp'],
    ['Jane Smith', '+919876543211', 'jane@example.com', 'Product Manager', 'StartupInc'],
    ['Mike Johnson', '+919876543212', 'mike@example.com', 'UI/UX Designer', 'DesignStudio']
  ];
  
  const csvContent = [
    headers.join(','),
    ...sampleData.map(row => row.map(field => `"${field}"`).join(','))
  ].join('\n');
  
  return csvContent;
};

export const downloadCSVTemplate = () => {
  const csvContent = generateCSVTemplate();
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'bulk-message-template.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
};

export const normalizeContactData = (csvData: Record<string, string>[]): any[] => {
  return csvData.map(row => {
    // Find phone number field (case insensitive)
    const phoneField = Object.keys(row).find(key => 
      key.toLowerCase().includes('phone') || key.toLowerCase().includes('mobile')
    );
    
    // Find name field (case insensitive)
    const nameField = Object.keys(row).find(key => 
      key.toLowerCase().includes('name')
    );
    
    // Find email field (case insensitive)
    const emailField = Object.keys(row).find(key => 
      key.toLowerCase().includes('email')
    );
    
    return {
      name: nameField ? row[nameField]?.trim() : '',
      phoneNumber: phoneField ? row[phoneField]?.trim() : '',
      email: emailField ? row[emailField]?.trim() : '',
      originalData: row
    };
  }).filter(contact => contact.name && contact.phoneNumber);
}; 