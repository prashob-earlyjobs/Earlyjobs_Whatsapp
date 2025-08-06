
import { useState, useEffect } from 'react';
import { Upload, FileText, Send, Download, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { templateApi, bulkMessageApi, LocalTemplate, ContactData } from '@/lib/api';
import { parseCSV, downloadCSVTemplate, normalizeContactData } from '@/utils/csvParser';
import { toast } from 'sonner';

interface ProcessedContact {
  name: string;
  phoneNumber: string;
  email?: string;
  isValid: boolean;
  errors: string[];
  [key: string]: any; // Allow dynamic properties for template variables
}

interface BulkMessagingProps {
  onBulkMessageComplete?: () => void;
}

export const BulkMessaging = ({ onBulkMessageComplete }: BulkMessagingProps) => {
  const [step, setStep] = useState(1);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<LocalTemplate | null>(null);
  const [contactsData, setContactsData] = useState<ContactData[]>([]);
  const [processedContacts, setProcessedContacts] = useState<ProcessedContact[]>([]);
  const [csvErrors, setCsvErrors] = useState<string[]>([]);
  const [bulkMessageName, setBulkMessageName] = useState('');
  const [sendingProgress, setSendingProgress] = useState(0);
  const [bulkMessageId, setBulkMessageId] = useState<string | null>(null);

  // Fetch templates
  const { data: templatesData, isLoading: isLoadingTemplates } = useQuery({
    queryKey: ['localTemplates'],
    queryFn: () => templateApi.getLocalTemplates(),
  });

  // Validate contacts mutation
  const validateContactsMutation = useMutation({
    mutationFn: (contacts: ContactData[]) => bulkMessageApi.validateContacts(contacts),
    onSuccess: (response) => {
      if (response.success) {
        const results = response.data.validationResults.map(result => ({
          name: result.originalData.name,
          phoneNumber: result.normalizedPhoneNumber || result.originalData.phoneNumber,
          email: result.originalData.email,
          isValid: result.isValid,
          errors: result.errors || [],
          // Preserve all custom variables from the original data
          ...result.originalData
        }));
        setProcessedContacts(results);
        setStep(3);
      }
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to validate contacts');
    },
  });

  // Create bulk message mutation
  const createBulkMessageMutation = useMutation({
    mutationFn: (data: {
      name: string;
      templateId: string;
      contactsData: ContactData[];
    }) => bulkMessageApi.createBulkMessage(data),
    onSuccess: (response) => {
      if (response.success) {
        setBulkMessageId(response.data.bulkMessage._id);
        setStep(4);
        toast.success('Bulk message started successfully!');
        // Trigger refresh of conversation list to show new conversations
        if (onBulkMessageComplete) {
          onBulkMessageComplete();
        }
        // Start polling for progress
        pollProgress(response.data.bulkMessage._id);
      }
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to create bulk message');
    },
  });

  // Poll for progress
  const pollProgress = async (id: string) => {
    const pollInterval = setInterval(async () => {
      try {
        const response = await bulkMessageApi.getBulkMessageStatus(id);
        if (response.success) {
          setSendingProgress(response.data.progress);
          
          if (response.data.status === 'completed' || response.data.status === 'failed') {
            clearInterval(pollInterval);
            if (response.data.status === 'completed') {
              toast.success('All messages sent successfully!');
              // Trigger refresh of conversation list to show new messages
              if (onBulkMessageComplete) {
                onBulkMessageComplete();
              }
            } else {
              toast.error('Some messages failed to send');
            }
          }
        }
      } catch (error) {
        clearInterval(pollInterval);
      }
    }, 2000);

    // Stop polling after 5 minutes
    setTimeout(() => clearInterval(pollInterval), 300000);
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setCsvFile(file);
    setCsvErrors([]);

    try {
      const result = await parseCSV(file);
      
      if (result.errors.length > 0) {
        setCsvErrors(result.errors);
        toast.error('CSV file has errors. Please check and fix them.');
        return;
      }

      // Enhanced contact normalization to include template variables
      const normalizedContacts = result.data.map(row => {
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
        
        const baseContact: any = {
          name: nameField ? row[nameField]?.trim() : '',
          phoneNumber: phoneField ? row[phoneField]?.trim() : '',
          email: emailField ? row[emailField]?.trim() : ''
        };

        // Add ALL columns from CSV as potential template variables
        Object.keys(row).forEach(key => {
          if (key && row[key] && !['name', 'phoneNumber', 'email'].includes(key.toLowerCase())) {
            baseContact[key] = row[key].trim();
          }
        });

        return baseContact;
      }).filter(contact => contact.name && contact.phoneNumber);
      
      if (normalizedContacts.length === 0) {
        setCsvErrors(['No valid contacts found in CSV file']);
        toast.error('No valid contacts found in CSV file');
        return;
      }

      setContactsData(normalizedContacts);
      toast.success(`Successfully loaded ${normalizedContacts.length} contacts`);
      
      // Auto-validate after successful file upload
      validateContactsMutation.mutate(normalizedContacts);
      
    } catch (error: any) {
      setCsvErrors([error.message]);
      toast.error('Failed to parse CSV file');
    }
  };

  const handleTemplateSelect = (template: LocalTemplate) => {
    setSelectedTemplate(template);
    setStep(2); // Move to file upload step after template selection
  };

  const handleValidateAndPreview = () => {
    if (!selectedTemplate || contactsData.length === 0) {
      toast.error('Please select a template and upload contacts');
      return;
    }

    validateContactsMutation.mutate(contactsData);
  };

  // Generate dynamic CSV template based on selected template variables
  const generateDynamicCSVTemplate = () => {
    if (!selectedTemplate) return;

    // Always include required fields plus template variables
    const headers = ['name', 'phoneNumber', ...selectedTemplate.body.variables.filter(v => v !== 'name' && v !== 'phoneNumber'), 'email'];
    
    const sampleData = [
      ['John Doe', '+919876543210', ...(selectedTemplate.body.variables.map(v => {
        if (v === 'name') return 'John Doe';
        if (v === 'phoneNumber' || v === 'phone') return '+919876543210';
        if (v === 'position') return 'Software Developer';
        if (v === 'company') return 'TechCorp';
        if (v === 'email') return 'john@example.com';
        return 'Sample Value';
      }).filter((_, index) => {
        const variable = selectedTemplate.body.variables[index];
        return variable !== 'name' && variable !== 'phoneNumber';
      })), 'john@example.com'],
      ['Jane Smith', '+919876543211', ...(selectedTemplate.body.variables.map(v => {
        if (v === 'name') return 'Jane Smith';
        if (v === 'phoneNumber' || v === 'phone') return '+919876543211';
        if (v === 'position') return 'Product Manager';
        if (v === 'company') return 'StartupInc';
        if (v === 'email') return 'jane@example.com';
        return 'Sample Value';
      }).filter((_, index) => {
        const variable = selectedTemplate.body.variables[index];
        return variable !== 'name' && variable !== 'phoneNumber';
      })), 'jane@example.com']
    ];
    
    const csvContent = [
      headers.join(','),
      ...sampleData.map(row => row.map(field => `"${field}"`).join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `${selectedTemplate.name.toLowerCase().replace(/\s+/g, '-')}-template.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handleSendBulkMessages = () => {
    if (!selectedTemplate) {
      toast.error('Please select a template first');
      return;
    }

    if (!bulkMessageName.trim()) {
      toast.error('Please provide a name for this bulk message');
      return;
    }

    const validContacts = processedContacts.filter(c => c.isValid);
    
    if (validContacts.length === 0) {
      toast.error('No valid contacts to send messages to');
      return;
    }

    createBulkMessageMutation.mutate({
      name: bulkMessageName.trim(),
      templateId: selectedTemplate._id,
      contactsData: validContacts.map(contact => {
        // Create contact data with all custom variables
        const contactData: ContactData = {
          name: contact.name,
          phoneNumber: contact.phoneNumber,
          email: contact.email
        };
        
        // Add all custom variables from the contact
        Object.keys(contact).forEach(key => {
          if (!['name', 'phoneNumber', 'email', 'isValid', 'errors'].includes(key)) {
            contactData[key] = contact[key];
          }
        });
        
        return contactData;
      })
    });
  };

  const resetWizard = () => {
    setStep(1);
    setCsvFile(null);
    setSelectedTemplate(null);
    setContactsData([]);
    setProcessedContacts([]);
    setCsvErrors([]);
    setBulkMessageName('');
    setSendingProgress(0);
    setBulkMessageId(null);
  };

  const localTemplates = templatesData?.data?.templates || [];
  const validContacts = processedContacts.filter(c => c.isValid);
  const invalidContacts = processedContacts.filter(c => !c.isValid);

  return (
    <div className="h-full p-6 overflow-y-auto">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-foreground mb-2">Bulk Messaging</h2>
          <p className="text-muted-foreground">Send WhatsApp messages to multiple clients at once</p>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center mb-8">
          {[
            { num: 1, label: 'Template' },
            { num: 2, label: 'Upload' },
            { num: 3, label: 'Preview' },
            { num: 4, label: 'Send' }
          ].map((stepInfo, index) => (
            <div key={stepInfo.num} className="flex items-center">
              <div className="flex flex-col items-center">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                    step >= stepInfo.num
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {stepInfo.num}
                </div>
                <span className={`text-xs mt-1 ${
                  step >= stepInfo.num
                    ? 'text-primary font-medium'
                    : 'text-muted-foreground'
                }`}>
                  {stepInfo.label}
                </span>
              </div>
              {index < 3 && (
                <div className={`w-16 h-1 mx-2 ${step > stepInfo.num ? 'bg-primary' : 'bg-muted'}`} />
              )}
            </div>
          ))}
        </div>

        {/* Step 1: Template Selection */}
        {step === 1 && (
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Step 1: Select Message Template</h3>
            
            {/* Bulk Message Name */}
            <div className="mb-6">
              <Label htmlFor="bulk-message-name">Bulk Message Name *</Label>
              <Input
                id="bulk-message-name"
                placeholder="Enter a name for this bulk message campaign"
                value={bulkMessageName}
                onChange={(e) => setBulkMessageName(e.target.value)}
                className="mt-2"
              />
            </div>

            {isLoadingTemplates ? (
              <div className="flex items-center justify-center p-8">
                <Loader2 className="w-8 h-8 animate-spin" />
                <span className="ml-2">Loading templates...</span>
              </div>
            ) : localTemplates.length === 0 ? (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  No templates found. Please create templates first in the Template Manager.
                </AlertDescription>
              </Alert>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                {localTemplates.map((template) => (
                  <Card
                    key={template._id}
                    className={`p-4 cursor-pointer transition-colors ${
                      selectedTemplate?._id === template._id
                        ? 'border-primary bg-primary/5'
                        : 'hover:bg-accent'
                    }`}
                    onClick={() => handleTemplateSelect(template)}
                  >
                    <h4 className="font-medium mb-2">{template.name}</h4>
                    <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                      {template.body.text}
                    </p>
                    <div className="flex flex-wrap gap-1">
                      <Badge variant="outline" className="text-xs">
                        {template.category}
                      </Badge>
                      {template.body.variables.map((variable) => (
                        <Badge key={variable} variant="secondary" className="text-xs">
                          {`{{${variable}}}`}
                        </Badge>
                      ))}
                    </div>
                  </Card>
                ))}
              </div>
            )}
            
            {!selectedTemplate && (
              <div className="text-center p-4">
                <p className="text-sm text-muted-foreground">
                  Please select a template to continue. The CSV file structure will be based on the template variables.
                </p>
              </div>
            )}
          </Card>
        )}

        {/* Step 2: File Upload */}
        {step === 2 && (
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Step 2: Upload Client Data</h3>
            
            {/* Selected Template Info */}
            <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h4 className="font-medium text-blue-900 mb-2">Selected Template: {selectedTemplate?.name}</h4>
              <p className="text-sm text-blue-700 mb-2">Required CSV columns based on template variables:</p>
              <div className="flex flex-wrap gap-1">
                <Badge variant="outline" className="text-xs bg-white">name *</Badge>
                <Badge variant="outline" className="text-xs bg-white">phoneNumber *</Badge>
                {selectedTemplate?.body.variables.filter(v => v !== 'name' && v !== 'phoneNumber').map((variable) => (
                  <Badge key={variable} variant="outline" className="text-xs bg-white">
                    {variable}
                  </Badge>
                ))}
                <Badge variant="outline" className="text-xs bg-white">email</Badge>
              </div>
            </div>

            <div className="space-y-4">
              {csvErrors.length > 0 && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <ul className="list-disc list-inside">
                      {csvErrors.map((error, index) => (
                        <li key={index}>{error}</li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}
              
              <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center">
                <Upload className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h4 className="text-lg font-medium mb-2">Upload CSV File</h4>
                <p className="text-muted-foreground mb-4">
                  Upload a CSV file with client information matching your selected template variables
                </p>
                <Input
                  type="file"
                  accept=".csv"
                  onChange={handleFileUpload}
                  className="hidden"
                  id="csv-upload"
                />
                <Button 
                  variant="outline" 
                  className="cursor-pointer"
                  onClick={() => document.getElementById('csv-upload')?.click()}
                >
                  <FileText className="w-4 h-4 mr-2" />
                  Choose File
                </Button>
                {csvFile && (
                  <p className="text-sm text-muted-foreground mt-2">
                    Selected: {csvFile.name}
                  </p>
                )}
              </div>
              <div className="flex items-center space-x-2">
                <Download className="w-4 h-4 text-muted-foreground" />
                <Button 
                  variant="link" 
                  className="p-0 text-sm"
                  onClick={generateDynamicCSVTemplate}
                >
                  Download CSV template for "{selectedTemplate?.name}"
                </Button>
              </div>
            </div>
            
            <div className="flex justify-between mt-6">
              <Button variant="outline" onClick={() => setStep(1)}>
                Back to Template Selection
              </Button>
              <Button 
                onClick={handleValidateAndPreview} 
                disabled={!csvFile || contactsData.length === 0 || validateContactsMutation.isPending}
              >
                {validateContactsMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Validating...
                  </>
                ) : (
                  'Next: Validate & Preview'
                )}
              </Button>
            </div>
          </Card>
        )}

        {/* Step 3: Validation & Preview */}
        {step === 3 && (
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Step 3: Validation Results & Preview</h3>
            
            {/* Validation Summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <Card className="p-4 bg-green-50 border-green-200">
                <div className="flex items-center space-x-2">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  <div>
                    <p className="text-sm font-medium">Valid Contacts</p>
                    <p className="text-lg font-bold text-green-600">{validContacts.length}</p>
                  </div>
                </div>
              </Card>
              
              <Card className="p-4 bg-red-50 border-red-200">
                <div className="flex items-center space-x-2">
                  <AlertCircle className="w-5 h-5 text-red-600" />
                  <div>
                    <p className="text-sm font-medium">Invalid Contacts</p>
                    <p className="text-lg font-bold text-red-600">{invalidContacts.length}</p>
                  </div>
                </div>
              </Card>
              
              <Card className="p-4 bg-blue-50 border-blue-200">
                <div className="flex items-center space-x-2">
                  <FileText className="w-5 h-5 text-blue-600" />
                  <div>
                    <p className="text-sm font-medium">Template</p>
                    <p className="text-sm font-medium text-blue-600">{selectedTemplate?.name}</p>
                  </div>
                </div>
              </Card>
            </div>

            {/* Bulk Message Name */}
            <div className="mb-6">
              <Label htmlFor="bulk-message-name-step3">Bulk Message Name *</Label>
              <Input
                id="bulk-message-name-step3"
                placeholder="Enter a name for this bulk message campaign"
                value={bulkMessageName}
                onChange={(e) => setBulkMessageName(e.target.value)}
                className="mt-2"
              />
              {!bulkMessageName.trim() && (
                <p className="text-sm text-red-600 mt-1">
                  Please provide a name for this bulk message
                </p>
              )}
            </div>

            {/* Invalid contacts list */}
            {invalidContacts.length > 0 && (
              <div className="mb-6">
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <p className="font-medium mb-2">Invalid Contacts:</p>
                    <div className="max-h-32 overflow-y-auto">
                      {invalidContacts.map((contact, index) => (
                        <div key={index} className="text-sm">
                          <strong>{contact.name}</strong> ({contact.phoneNumber}): {contact.errors.join(', ')}
                        </div>
                      ))}
                    </div>
                  </AlertDescription>
                </Alert>
              </div>
            )}

            {/* Preview messages */}
            {validContacts.length > 0 && (
              <div className="space-y-4 mb-6">
                <h4 className="font-medium">Message Preview:</h4>
                
                {/* Debug: Show available variables */}
                <div className="mb-4 p-3 bg-gray-50 border rounded-lg">
                  <h5 className="text-sm font-medium mb-2">Available Variables from CSV:</h5>
                  <div className="flex flex-wrap gap-2">
                    {Object.keys(validContacts[0] || {}).map(key => {
                      if (!['name', 'phoneNumber', 'email', 'isValid', 'errors'].includes(key)) {
                        return (
                          <Badge key={key} variant="outline" className="text-xs">
                            {key}
                          </Badge>
                        );
                      }
                      return null;
                    })}
                  </div>
                </div>
                
                <div className="space-y-3 max-h-60 overflow-y-auto">
                  {validContacts.slice(0, 3).map((contact, index) => {
                    const previewText = selectedTemplate?.body.text.replace(
                      /\{\{(\w+)\}\}/g, 
                      (match: string, key: string) => {
                        // First, try to get the value directly from contact data
                        if (contact[key] !== undefined && contact[key] !== null) {
                          return String(contact[key]);
                        }
                        
                        // Fallback mappings for common fields
                        const mappings: Record<string, string> = {
                          name: contact.name,
                          phoneNumber: contact.phoneNumber,
                          phone: contact.phoneNumber,
                          email: contact.email || ''
                        };
                        
                        return mappings[key] || match;
                      }
                    ) || '';
                    
                    return (
                      <div key={index} className="border rounded-lg p-3 bg-muted/30">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium text-sm">{contact.name}</span>
                          <span className="text-xs text-muted-foreground">{contact.phoneNumber}</span>
                        </div>
                        <p className="text-sm whitespace-pre-wrap">{previewText}</p>
                      </div>
                    );
                  })}
                  {validContacts.length > 3 && (
                    <p className="text-sm text-muted-foreground text-center">
                      ...and {validContacts.length - 3} more messages
                    </p>
                  )}
                </div>
              </div>
            )}
            
            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(2)}>
                Back to File Upload
              </Button>
              <Button 
                onClick={handleSendBulkMessages} 
                disabled={validContacts.length === 0 || createBulkMessageMutation.isPending || !bulkMessageName.trim()}
                className="bg-green-600 hover:bg-green-700"
              >
                {createBulkMessageMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Starting...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-2" />
                    Send {validContacts.length} Messages
                  </>
                )}
              </Button>
            </div>
          </Card>
        )}

        {/* Step 4: Sending Progress */}
        {step === 4 && (
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">
              {sendingProgress < 100 ? 'Sending Messages...' : 'Messages Sent Successfully!'}
            </h3>
            <div className="space-y-4">
              <Progress value={sendingProgress} className="w-full" />
              <p className="text-sm text-muted-foreground text-center">
                {sendingProgress < 100 
                  ? `Sending ${Math.floor((sendingProgress / 100) * validContacts.length)} of ${validContacts.length} messages...`
                  : `All ${validContacts.length} messages sent successfully!`
                }
              </p>
              {sendingProgress >= 100 && (
                <div className="flex justify-center space-x-2">
                  <Button onClick={resetWizard}>
                    Send Another Batch
                  </Button>
                  <Button variant="outline" onClick={() => setStep(1)}>
                    Back to Dashboard
                  </Button>
                </div>
              )}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
};
