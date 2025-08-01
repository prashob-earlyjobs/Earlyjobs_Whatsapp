import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Phone, User, MessageSquare, X, Loader2, ChevronDown, Search, Users, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { conversationApi, Conversation, templateApi, LocalTemplate, contactApi, Contact } from '@/lib/api';
import { toast } from 'sonner';
import { useDebounce } from '@/hooks/useDebounce';

interface StartConversationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (conversation: Conversation) => void;
}

interface FormData {
  phoneNumber: string;
  countryCode: string;
  name: string;
  selectedTemplate: LocalTemplate | null;
  templateVariables: Record<string, string>;
  selectedContact: Contact | null;
}

interface ContactSuggestion {
  contact: Contact;
  matchType: 'phone' | 'name';
  hasExistingConversation?: boolean;
  conversation?: Conversation;
}

export const StartConversationModal: React.FC<StartConversationModalProps> = ({
  isOpen,
  onClose,
  onSuccess
}) => {
  const [formData, setFormData] = useState<FormData>({
    phoneNumber: '',
    countryCode: '91',
    name: '',
    selectedTemplate: null,
    templateVariables: {},
    selectedContact: null
  });
  const [error, setError] = useState<string | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedExistingConversation, setSelectedExistingConversation] = useState<Conversation | null>(null);
  const [showTemplateMessageSection, setShowTemplateMessageSection] = useState(false);

  const queryClient = useQueryClient();

  // Debounce phone number input for contact search
  const debouncedPhoneNumber = useDebounce(formData.phoneNumber, 300);

  // Fetch local templates from database
  const { data: templatesData, isLoading: isLoadingTemplates } = useQuery({
    queryKey: ['localTemplates'],
    queryFn: () => templateApi.getLocalTemplates(),
    enabled: isOpen, // Only fetch when modal is open
  });

  // Search contacts based on phone number input
  const { data: contactSuggestions, isLoading: isLoadingContacts } = useQuery({
    queryKey: ['contactSearch', debouncedPhoneNumber],
    queryFn: () => contactApi.searchContacts(debouncedPhoneNumber, 5),
    enabled: isOpen && debouncedPhoneNumber.length >= 3,
    staleTime: 30000, // Cache for 30 seconds
  });

  // Get conversations to check for existing conversations
  const { data: conversationsData } = useQuery({
    queryKey: ['conversations'],
    queryFn: () => conversationApi.getConversations({}),
    enabled: isOpen,
    staleTime: 30000,
  });

  // Start conversation mutation
  const startConversationMutation = useMutation({
    mutationFn: (data: {
      phoneNumber: string;
      name: string;
      initialMessage?: string;
    }) => conversationApi.startConversation(data),
    onSuccess: (response) => {
      if (response.success) {
        // Invalidate conversations query to refresh the list
        queryClient.invalidateQueries({ queryKey: ['conversations'] });
        
        // Show success message
        toast.success('Conversation started successfully!');
        
        // Call the onSuccess callback
        onSuccess(response.data.conversation);
        handleClose();
      } else {
        setError(response.message || 'Failed to start conversation');
      }
    },
    onError: (error: any) => {
      console.error('Start conversation error:', error);
      setError(error.response?.data?.message || 'Failed to start conversation');
    },
  });

  // Send template message to existing conversation mutation
  const sendTemplateMessageMutation = useMutation({
    mutationFn: (data: {
      conversationId: string;
      templateId: string;
      templateData: Record<string, string>;
    }) => conversationApi.sendMessage(data.conversationId, { 
      type: 'template', 
      content: { 
        templateId: data.templateId,
        templateData: data.templateData
      } 
    }),
    onSuccess: (response) => {
      if (response.success) {
        // Invalidate conversations and messages queries
        queryClient.invalidateQueries({ queryKey: ['conversations'] });
        queryClient.invalidateQueries({ queryKey: ['messages'] });
        
        // Show success message
        toast.success('Template message sent successfully!');
        
        // Open the conversation
        if (selectedExistingConversation) {
          onSuccess(selectedExistingConversation);
        }
        handleClose();
      } else {
        setError(response.message || 'Failed to send message');
      }
    },
    onError: (error: any) => {
      console.error('Send template message error:', error);
      setError(error.response?.data?.message || 'Failed to send message');
    },
  });

  const localTemplates = templatesData?.data?.templates || [];
  const contacts = contactSuggestions?.data?.contacts || [];
  const conversations = conversationsData?.data?.conversations || [];

  // Generate contact suggestions with existing conversation info
  const contactSuggestionsForPhone = useMemo((): ContactSuggestion[] => {
    if (!debouncedPhoneNumber || debouncedPhoneNumber.length < 3) return [];
    
    return contacts.map(contact => {
      // Check if this contact has an existing conversation
      const existingConversation = conversations.find(conv => 
        conv.contactId._id === contact._id || 
        conv.contactId.phoneNumber === contact.phoneNumber
      );

      return {
        contact,
        matchType: contact.phoneNumber.includes(debouncedPhoneNumber) ? 'phone' as const : 'name' as const,
        hasExistingConversation: !!existingConversation,
        conversation: existingConversation
      };
    });
  }, [contacts, debouncedPhoneNumber, conversations]);

  // Auto-fill name when exact phone number match is found
  useEffect(() => {
    if (formData.selectedContact) return; // Don't auto-fill if contact manually selected
    
    const fullPhoneNumber = `+${formData.countryCode}${formData.phoneNumber}`;
    const exactMatch = contacts.find(contact => 
      contact.phoneNumber === fullPhoneNumber || 
      contact.phoneNumber === formData.phoneNumber ||
      contact.phoneNumber.replace(/\D/g, '') === formData.phoneNumber.replace(/\D/g, '')
    );
    
    if (exactMatch && formData.name !== exactMatch.name) {
      setFormData(prev => ({ 
        ...prev, 
        name: exactMatch.name,
        selectedContact: exactMatch
      }));
      setShowSuggestions(false);
      toast.success(`Auto-filled contact: ${exactMatch.name}`);
    }
  }, [contacts, formData.phoneNumber, formData.countryCode, formData.selectedContact, formData.name]);

  // Reset template variables when template changes
  useEffect(() => {
    if (formData.selectedTemplate) {
      const initialVariables: Record<string, string> = {};
      formData.selectedTemplate.body.variables.forEach(variable => {
        // Auto-fill name variable with contact name if available
        if (variable === 'name' && formData.name) {
          initialVariables[variable] = formData.name;
        } else {
          initialVariables[variable] = formData.templateVariables[variable] || '';
        }
      });
      setFormData(prev => ({
        ...prev,
        templateVariables: initialVariables
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        templateVariables: {}
      }));
    }
  }, [formData.selectedTemplate, formData.name]);

  const handleInputChange = (field: keyof Omit<FormData, 'selectedTemplate' | 'templateVariables' | 'selectedContact'>, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (error) setError(null);
    
    // Reset selected contact if user manually changes phone or name
    if (field === 'phoneNumber' || field === 'name') {
      setFormData(prev => ({ ...prev, selectedContact: null }));
      if (field === 'phoneNumber') {
        setShowSuggestions(value.length >= 3);
      }
    }
  };

  const handleContactSelect = (suggestion: ContactSuggestion) => {
    const { contact, hasExistingConversation, conversation } = suggestion;
    
    // If contact has existing conversation, set up template messaging mode
    if (hasExistingConversation && conversation) {
      setSelectedExistingConversation(conversation);
      setShowTemplateMessageSection(true);
      
      // Fill the form with contact details for template variable population
      const phoneWithoutPlus = contact.phoneNumber.startsWith('+') ? contact.phoneNumber.slice(1) : contact.phoneNumber;
      const countryCodeMatch = phoneWithoutPlus.match(/^(\d{1,3})/);
      const countryCode = countryCodeMatch ? countryCodeMatch[1] : '91';
      const phoneNumber = phoneWithoutPlus.replace(countryCode, '');
      
      setFormData(prev => ({
        ...prev,
        phoneNumber,
        countryCode,
        name: contact.name,
        selectedContact: contact
      }));
      setShowSuggestions(false);
      toast.success(`Selected ${contact.name} for template message`);
      return;
    }
    
    // Otherwise, fill the form with contact details for new conversation
    const phoneWithoutPlus = contact.phoneNumber.startsWith('+') ? contact.phoneNumber.slice(1) : contact.phoneNumber;
    
    // Extract country code (assume first 1-3 digits)
    const countryCodeMatch = phoneWithoutPlus.match(/^(\d{1,3})/);
    const countryCode = countryCodeMatch ? countryCodeMatch[1] : '91';
    const phoneNumber = phoneWithoutPlus.replace(countryCode, '');
    
    setFormData(prev => ({
      ...prev,
      phoneNumber,
      countryCode,
      name: contact.name,
      selectedContact: contact
    }));
    setShowSuggestions(false);
    setShowTemplateMessageSection(false);
    setSelectedExistingConversation(null);
    toast.success(`Selected contact: ${contact.name}`);
  };

  const handleTemplateSelect = (templateId: string) => {
    const template = localTemplates.find(t => t._id === templateId) || null;
    setFormData(prev => ({ ...prev, selectedTemplate: template }));
    if (error) setError(null);
  };

  const handleVariableChange = (variable: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      templateVariables: {
        ...prev.templateVariables,
        [variable]: value
      }
    }));
    if (error) setError(null);
  };

  const formatPhoneNumber = (countryCode: string, phone: string) => {
    // Remove any non-digits from phone number
    const cleanPhone = phone.replace(/\D/g, '');
    // Combine country code with phone number
    return `+${countryCode}${cleanPhone}`;
  };

  const validateForm = (): string | null => {
    if (!formData.countryCode.trim()) {
      return 'Country code is required';
    }

    if (!formData.phoneNumber.trim()) {
      return 'Phone number is required';
    }
    
    if (!formData.name.trim()) {
      return 'Contact name is required';
    }

    if (!formData.selectedTemplate) {
      return 'Please select a message template';
    }

    // Validate that all template variables are filled
    const missingVariables = formData.selectedTemplate.body.variables.filter(
      variable => !formData.templateVariables[variable]?.trim()
    );

    if (missingVariables.length > 0) {
      return `Please fill in all template variables: ${missingVariables.join(', ')}`;
    }

    // Validate country code (should be numeric)
    if (!/^\d{1,4}$/.test(formData.countryCode)) {
      return 'Please enter a valid country code (1-4 digits)';
    }

    // Validate phone number (should be numeric and appropriate length)
    const cleanPhone = formData.phoneNumber.replace(/\D/g, '');
    if (!/^\d{7,12}$/.test(cleanPhone)) {
      return 'Please enter a valid phone number (7-12 digits)';
    }

    return null;
  };

  const buildTemplateMessage = (template: LocalTemplate): string => {
    let message = template.body.text;
    
    // Replace variables with user-provided values
    template.body.variables.forEach((variable, index) => {
      const variableValue = formData.templateVariables[variable] || `[${variable.toUpperCase()}]`;
      
      // Handle both named variables {{name}} and numbered variables {{1}}, {{2}}, etc.
      const patterns = [
        new RegExp(`\\{\\{${variable}\\}\\}`, 'g'),
        new RegExp(`\\{\\{${index + 1}\\}\\}`, 'g')
      ];
      
      patterns.forEach(pattern => {
        message = message.replace(pattern, variableValue);
      });
    });
    
    return message;
  };

  const getVariableDisplayName = (variable: string, index: number): string => {
    // Just return the variable name/number as is
    return `{{${variable}}}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    const initialMessage = formData.selectedTemplate 
      ? buildTemplateMessage(formData.selectedTemplate)
      : undefined;

    startConversationMutation.mutate({
      phoneNumber: formatPhoneNumber(formData.countryCode.trim(), formData.phoneNumber.trim()),
      name: formData.name.trim(),
      initialMessage
    });
  };

  const handleSendTemplateMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedExistingConversation || !formData.selectedTemplate) {
      setError('Please select a template to send');
      return;
    }

    // Validate template variables are filled
    const missingVariables = formData.selectedTemplate.body.variables.filter(
      variable => !formData.templateVariables[variable]?.trim()
    );
    
    if (missingVariables.length > 0) {
      setError(`Please fill in all template variables: ${missingVariables.join(', ')}`);
      return;
    }

    sendTemplateMessageMutation.mutate({
      conversationId: selectedExistingConversation._id,
      templateId: formData.selectedTemplate._id,
      templateData: formData.templateVariables
    });
  };

  const handleClose = () => {
    setFormData({
      phoneNumber: '',
      countryCode: '91',
      name: '',
      selectedTemplate: null,
      templateVariables: {},
      selectedContact: null
    });
    setError(null);
    setShowSuggestions(false);
    setSelectedExistingConversation(null);
    setShowTemplateMessageSection(false);
    onClose();
  };

  const isFormValid = () => {
    const basicFieldsValid = formData.phoneNumber.trim() && 
                           formData.countryCode.trim() &&
                           formData.name.trim() && 
                           formData.selectedTemplate &&
                           !startConversationMutation.isPending;
    
    if (!basicFieldsValid) return false;

    // Check if all template variables are filled
    if (formData.selectedTemplate) {
      const allVariablesFilled = formData.selectedTemplate.body.variables.every(
        variable => formData.templateVariables[variable]?.trim()
      );
      return allVariablesFilled;
    }

    return false;
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5" />
            {showTemplateMessageSection 
              ? `Send Template Message to ${formData.name}` 
              : 'Start New Conversation'
            }
          </DialogTitle>
          <DialogDescription>
            {showTemplateMessageSection 
              ? `Send a template message to ${formData.name} in their existing conversation.`
              : 'Enter a phone number to start a conversation. If the contact exists, you can send them a template message or create a new conversation.'
            }
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={showTemplateMessageSection ? handleSendTemplateMessage : handleSubmit} className="space-y-4">
          {/* Error Alert */}
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Template Message Section for Existing Contacts */}
          {showTemplateMessageSection && selectedExistingConversation ? (
            <>
              {/* Contact Info Display */}
              <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                    <User className="w-5 h-5 text-green-600" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-green-900">{formData.name}</p>
                    <p className="text-sm text-green-700">+{formData.countryCode}{formData.phoneNumber}</p>
                    <p className="text-xs text-green-600">Existing conversation found</p>
                  </div>
                  <Badge variant="default" className="bg-green-100 text-green-800 hover:bg-green-200">
                    Existing
                  </Badge>
                </div>
              </div>

              {/* Template Selection */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4" />
                  Select Template *
                </Label>
                {isLoadingTemplates ? (
                  <div className="flex items-center justify-center p-3 text-sm text-muted-foreground">
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Loading templates...
                  </div>
                ) : localTemplates.length === 0 ? (
                  <Alert>
                    <AlertDescription>
                      No templates found. Please create templates first.
                    </AlertDescription>
                  </Alert>
                ) : (
                  <Select 
                    value={formData.selectedTemplate?._id || ""} 
                    onValueChange={handleTemplateSelect}
                    disabled={sendTemplateMessageMutation.isPending}
                    required
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a template to send" />
                    </SelectTrigger>
                    <SelectContent>
                      {localTemplates.map((template) => (
                        <SelectItem key={template._id} value={template._id}>
                          <div className="flex flex-col items-start w-full">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{template.name}</span>
                              <Badge variant="outline" className="text-xs">
                                {template.category}
                              </Badge>
                            </div>
                            <span className="text-xs text-muted-foreground truncate max-w-[300px]">
                              {template.body.text.substring(0, 80)}
                              {template.body.text.length > 80 ? '...' : ''}
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              {/* Template Variables */}
              {formData.selectedTemplate && formData.selectedTemplate.body.variables.length > 0 && (
                <div className="space-y-3">
                  <Label className="text-sm font-medium">Template Variables *</Label>
                  <div className="space-y-3 p-3 bg-muted/50 rounded-lg">
                    {formData.selectedTemplate.body.variables.map((variable, index) => (
                      <div key={variable} className="space-y-1">
                        <Label htmlFor={`variable-${variable}`} className="text-sm">
                          {getVariableDisplayName(variable, index)} *
                        </Label>
                        <Input
                          id={`variable-${variable}`}
                          type="text"
                          placeholder={`Enter value for {{${variable}}}`}
                          value={formData.templateVariables[variable] || (variable === 'name' ? formData.name : '')}
                          onChange={(e) => handleVariableChange(variable, e.target.value)}
                          required
                          disabled={sendTemplateMessageMutation.isPending}
                          className="text-sm"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Template Preview */}
              {formData.selectedTemplate && (
                <div className="mt-4 p-3 bg-muted rounded-md">
                  <p className="text-sm font-medium mb-2">Message Preview:</p>
                  {formData.selectedTemplate.header && (
                    <p className="text-sm font-semibold mb-2">
                      {formData.selectedTemplate.header.content}
                    </p>
                  )}
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {buildTemplateMessage(formData.selectedTemplate)}
                  </p>
                  {formData.selectedTemplate.footer && (
                    <p className="text-xs text-muted-foreground mt-2 italic">
                      {formData.selectedTemplate.footer}
                    </p>
                  )}
                </div>
              )}

              {/* Action Buttons for Template Message */}
              <div className="flex justify-end space-x-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowTemplateMessageSection(false);
                    setSelectedExistingConversation(null);
                    setFormData(prev => ({ ...prev, selectedTemplate: null, templateVariables: {} }));
                  }}
                  disabled={sendTemplateMessageMutation.isPending}
                >
                  Back to Search
                </Button>
                <Button
                  type="submit"
                  disabled={!formData.selectedTemplate || sendTemplateMessageMutation.isPending}
                  className="min-w-[120px] bg-green-600 hover:bg-green-700"
                >
                  {sendTemplateMessageMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4 mr-2" />
                      Send Message
                    </>
                  )}
                </Button>
              </div>
            </>
          ) : (
            <>
              {/* Original New Conversation Form */}
              {/* Phone Number */}
              <div className="space-y-2 relative">
                <Label className="flex items-center gap-2">
                  <Phone className="w-4 h-4" />
                  Phone Number *
                </Label>
                <div className="flex gap-2">
                  {/* Country Code */}
                  <div className="w-20">
                    <Input
                      type="text"
                      placeholder="91"
                      value={formData.countryCode}
                      onChange={(e) => handleInputChange('countryCode', e.target.value.replace(/\D/g, ''))}
                      required
                      disabled={startConversationMutation.isPending}
                      className="text-center"
                      maxLength={4}
                    />
                    <p className="text-xs text-muted-foreground text-center mt-1">Code</p>
                  </div>
                  
                  {/* Phone Number */}
                  <div className="flex-1 relative">
                    <Input
                      type="tel"
                      placeholder="1234567890"
                      value={formData.phoneNumber}
                      onChange={(e) => handleInputChange('phoneNumber', e.target.value.replace(/\D/g, ''))}
                      required
                      disabled={startConversationMutation.isPending}
                      maxLength={12}
                      onFocus={() => setShowSuggestions(formData.phoneNumber.length >= 3)}
                      onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                    />
                    <p className="text-xs text-muted-foreground mt-1">Phone number</p>
                    
                    {/* Contact Suggestions Dropdown */}
                    {showSuggestions && contactSuggestionsForPhone.length > 0 && (
                      <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-y-auto">
                        {isLoadingContacts && (
                          <div className="flex items-center justify-center p-3 text-sm text-muted-foreground">
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Searching contacts...
                          </div>
                        )}
                        {contactSuggestionsForPhone.map((suggestion, index) => (
                          <div
                            key={suggestion.contact._id}
                            className={`flex items-center justify-between p-3 hover:bg-gray-50 cursor-pointer border-b last:border-b-0 ${
                              suggestion.hasExistingConversation ? 'bg-green-50 hover:bg-green-100' : ''
                            }`}
                            onClick={() => handleContactSelect(suggestion)}
                          >
                            <div className="flex items-center gap-3">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                                suggestion.hasExistingConversation ? 'bg-green-100' : 'bg-blue-100'
                              }`}>
                                <User className={`w-4 h-4 ${
                                  suggestion.hasExistingConversation ? 'text-green-600' : 'text-blue-600'
                                }`} />
                              </div>
                              <div>
                                <p className="text-sm font-medium">{suggestion.contact.name}</p>
                                <p className="text-xs text-muted-foreground">
                                  {suggestion.contact.phoneNumber}
                                </p>
                                {suggestion.hasExistingConversation && (
                                  <p className="text-xs text-green-600 font-medium">
                                    Click to send template message
                                  </p>
                                )}
                              </div>
                            </div>
                            <div className="flex flex-col gap-1">
                              <Badge variant="outline" className="text-xs">
                                {suggestion.matchType}
                              </Badge>
                              {suggestion.hasExistingConversation && (
                                <Badge variant="default" className="text-xs bg-green-100 text-green-800 hover:bg-green-200">
                                  Existing
                                </Badge>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Final number will be: +{formData.countryCode}{formData.phoneNumber}
                  {formData.selectedContact && (
                    <span className="text-green-600 font-medium ml-2">
                      ✓ Contact found: {formData.selectedContact.name}
                    </span>
                  )}
                </p>
              </div>

              {/* Name */}
              <div className="space-y-2">
                <Label htmlFor="name" className="flex items-center gap-2">
                  <User className="w-4 h-4" />
                  Contact Name *
                  {formData.selectedContact && (
                    <Badge variant="secondary" className="text-xs">Auto-filled</Badge>
                  )}
                </Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="Enter contact name"
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  required
                  disabled={startConversationMutation.isPending}
                />
              </div>

              {/* Template Selection */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4" />
                  Message Template *
                </Label>
                {isLoadingTemplates ? (
                  <div className="flex items-center justify-center p-3 text-sm text-muted-foreground">
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Loading templates...
                  </div>
                ) : localTemplates.length === 0 ? (
                  <Alert>
                    <AlertDescription>
                      No templates found. Please create templates first.
                    </AlertDescription>
                  </Alert>
                ) : (
                  <Select 
                    value={formData.selectedTemplate?._id || ""} 
                    onValueChange={handleTemplateSelect}
                    disabled={startConversationMutation.isPending}
                    required
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a message template" />
                    </SelectTrigger>
                    <SelectContent>
                      {localTemplates.map((template) => (
                        <SelectItem key={template._id} value={template._id}>
                          <div className="flex flex-col items-start w-full">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{template.name}</span>
                              <Badge variant="outline" className="text-xs">
                                {template.category}
                              </Badge>
                            </div>
                            <span className="text-xs text-muted-foreground truncate max-w-[300px]">
                              {template.body.text.substring(0, 80)}
                              {template.body.text.length > 80 ? '...' : ''}
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              {/* Template Variables */}
              {formData.selectedTemplate && formData.selectedTemplate.body.variables.length > 0 && (
                <div className="space-y-3">
                  <Label className="text-sm font-medium">Template Variables *</Label>
                  <div className="space-y-3 p-3 bg-muted/50 rounded-lg">
                    {formData.selectedTemplate.body.variables.map((variable, index) => (
                      <div key={variable} className="space-y-1">
                        <Label htmlFor={`variable-${variable}`} className="text-sm">
                          {getVariableDisplayName(variable, index)} *
                        </Label>
                        <Input
                          id={`variable-${variable}`}
                          type="text"
                          placeholder={`Enter value for {{${variable}}}`}
                          value={formData.templateVariables[variable] || (variable === 'name' ? formData.name : '')}
                          onChange={(e) => handleVariableChange(variable, e.target.value)}
                          required
                          disabled={startConversationMutation.isPending}
                          className="text-sm"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Template Preview */}
              {formData.selectedTemplate && (
                <div className="mt-4 p-3 bg-muted rounded-md">
                  <p className="text-sm font-medium mb-2">Message Preview:</p>
                  {formData.selectedTemplate.header && (
                    <p className="text-sm font-semibold mb-2">
                      {formData.selectedTemplate.header.content}
                    </p>
                  )}
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {buildTemplateMessage(formData.selectedTemplate)}
                  </p>
                  {formData.selectedTemplate.footer && (
                    <p className="text-xs text-muted-foreground mt-2 italic">
                      {formData.selectedTemplate.footer}
                    </p>
                  )}
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex justify-end space-x-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleClose}
                  disabled={startConversationMutation.isPending}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={!isFormValid()}
                  className="min-w-[120px]"
                >
                  {startConversationMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Starting...
                    </>
                  ) : (
                    'Start Conversation'
                  )}
                </Button>
              </div>
            </>
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default StartConversationModal; 