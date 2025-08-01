import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Search, Plus, Eye, Save, Loader2, AlertCircle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter 
} from '@/components/ui/dialog';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { toast } from 'sonner';

import { templateApi, GupshupTemplate } from '@/lib/api';
import { tokenManager } from '@/lib/auth-api';

// Form validation schema
const templateSchema = z.object({
  selectedGupshupTemplate: z.string().optional(),
  customName: z.string().optional(),
  category: z.string().min(1, 'Category is required'),
  language: z.string().min(1, 'Language is required'),
  department: z.string().optional(),
  body: z.string().min(1, 'Template body is required'),
  header: z.string().optional(),
  footer: z.string().optional(),
});

type TemplateFormData = z.infer<typeof templateSchema>;

interface CreateTemplateModalProps {
  open: boolean;
  onClose: () => void;
}

export const CreateTemplateModal = ({ open, onClose }: CreateTemplateModalProps) => {
  console.log('🔍 CreateTemplateModal render - open:', open);
  
  // ALL HOOKS MUST BE CALLED FIRST - before any conditional returns
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGupshupTemplate, setSelectedGupshupTemplate] = useState<GupshupTemplate | null>(null);
  const [showGupshupPreview, setShowGupshupPreview] = useState(false);
  
  const queryClient = useQueryClient();
  
  // Check if a Gupshup template is selected (makes fields read-only)
  const isGupshupTemplateSelected = !!selectedGupshupTemplate;

  const form = useForm<TemplateFormData>({
    resolver: zodResolver(templateSchema),
    defaultValues: {
      selectedGupshupTemplate: '',
      customName: '',
      category: '',
      language: 'en',
      department: '',
      body: '',
      header: '',
      footer: '',
    },
  });

  // Fetch Gupshup templates
  const { data: gupshupTemplatesData, isLoading: isLoadingGupshup, error: gupshupError } = useQuery({
    queryKey: ['gupshupTemplates', { search: searchQuery, status: 'ENABLED' }],
    queryFn: () => templateApi.getGupshupTemplates({ 
      search: searchQuery || undefined,
      status: 'ENABLED',
      limit: 1000 
    }),
    enabled: open,
    retry: 1,
    retryDelay: 1000,
  });

  // Save template mutation
  const saveTemplateMutation = useMutation({
    mutationFn: (data: { gupshupTemplateId: number; customName?: string }) => {
      console.log('📡 Making API call to save Gupshup template:', data);
      console.log('📡 Current token:', tokenManager.getToken()?.substring(0, 20) + '...');
      return templateApi.saveGupshupTemplate(data);
    },
    onSuccess: () => {
      console.log('✅ Template saved successfully');
      queryClient.invalidateQueries({ queryKey: ['localTemplates'] });
      toast.success('Template saved successfully!');
      onClose();
      form.reset();
      setSelectedGupshupTemplate(null);
    },
    onError: (error: any) => {
      console.error('❌ Template save error:', error);
      console.error('❌ Error response:', error.response);
      console.error('❌ Error message:', error.message);
      
      const errorMessage = error.response?.data?.message || error.message || 'Failed to save template';
      toast.error(`Failed to save template: ${errorMessage}`);
      
      // If it's an auth error, suggest re-login
      if (errorMessage.includes('Access token required') || errorMessage.includes('token')) {
        toast.error('Authentication issue detected. Please try logging out and back in.');
      }
    },
  });

  // Create custom template mutation
  const createCustomMutation = useMutation({
    mutationFn: (data: {
      name: string;
      category: string;
      language: string;
      department?: string;
      body: string;
      header?: string;
      footer?: string;
    }) => templateApi.createCustomTemplate(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['localTemplates'] });
      toast.success('Custom template created successfully!');
      onClose();
      form.reset();
      setSelectedGupshupTemplate(null);
    },
    onError: (error: any) => {
      const errorMessage = error.response?.data?.message || error.message || 'Failed to create template';
      toast.error(errorMessage);
    },
  });

  // Debug: Log auth status when modal opens
  React.useEffect(() => {
    if (open) {
      const token = tokenManager.getToken();
      const user = tokenManager.getUser();
      console.log('🔍 Modal opened - Auth status:');
      console.log('Token exists:', !!token);
      console.log('User exists:', !!user);
      console.log('User role:', user?.role || 'No user');
    }
  }, [open]);

  // Update form validation when Gupshup template selection changes
  useEffect(() => {
    form.clearErrors();
  }, [isGupshupTemplateSelected, form]);

  // Reset form when modal closes
  useEffect(() => {
    if (!open) {
      form.reset();
      setSelectedGupshupTemplate(null);
      setSearchQuery('');
      setShowGupshupPreview(false);
    }
  }, [open, form]);

  // NOW we can have conditional returns after all hooks are called
  if (!open) {
    console.log('🔍 Modal not open, returning null');
    return null;
  }

  console.log('🔍 Modal is open, rendering content');

  // Handle Gupshup template selection
  const handleGupshupTemplateSelect = (templateId: string) => {
    const template = gupshupTemplatesData?.data.templates.find(t => t.id.toString() === templateId);
    if (template) {
      setSelectedGupshupTemplate(template);
      
      // Auto-fill form fields - these will be read-only except for customName
      form.setValue('selectedGupshupTemplate', templateId);
      form.setValue('customName', template.name);
      form.setValue('category', template.category.toLowerCase());
      form.setValue('language', template.language);
      form.setValue('body', template.body);
      form.setValue('header', template.header || '');
      form.setValue('footer', template.footer || '');
    }
  };

  // Submit handler
  const onSubmit = (data: TemplateFormData) => {
    // Debug authentication status
    const token = tokenManager.getToken();
    const user = tokenManager.getUser();
    
    console.log('🔍 Debug Auth Status:');
    console.log('Token exists:', !!token);
    console.log('Token length:', token?.length || 0);
    console.log('User exists:', !!user);
    console.log('User ID:', user?.id || 'No user');
    
    if (!token) {
      toast.error('You must be logged in to save templates. Please refresh the page and try again.');
      return;
    }
    
    if (selectedGupshupTemplate && data.selectedGupshupTemplate) {
      // Save from Gupshup - custom name is optional
      console.log('🚀 Attempting to save Gupshup template with token:', token.substring(0, 20) + '...');
      saveTemplateMutation.mutate({
        gupshupTemplateId: selectedGupshupTemplate.id,
        customName: data.customName && data.customName.trim() && data.customName !== selectedGupshupTemplate.name 
          ? data.customName 
          : undefined,
      });
    } else {
      // Create custom template - customName is required for custom templates
      if (!data.customName?.trim()) {
        form.setError('customName', { 
          type: 'required', 
          message: 'Template name is required for custom templates' 
        });
        return;
      }
      
      createCustomMutation.mutate({
        name: data.customName,
        category: data.category,
        language: data.language,
        department: data.department || undefined,
        body: data.body,
        header: data.header || undefined,
        footer: data.footer || undefined,
      });
    }
  };

  // Extract variables from template body
  const extractVariables = (text: string) => {
    const matches = text.match(/\{\{(\w+|\d+)\}\}/g) || [];
    return matches.map(match => match.replace(/[{}]/g, ''));
  };

  const currentBodyText = form.watch('body');
  const variables = extractVariables(currentBodyText);

  const filteredTemplates = gupshupTemplatesData?.data.templates.filter(template =>
    template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    template.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
    template.body.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  console.log('🔍 About to render Dialog');
  try {
    return (
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {isGupshupTemplateSelected 
                ? `Save Gupshup Template: ${selectedGupshupTemplate?.name}` 
                : "Create New Template"
              }
            </DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left Side - Gupshup Template Selection */}
            <div className="space-y-4">
              <div>
                <Label className="text-sm font-medium">Select from Gupshup Templates (Optional)</Label>
                <p className="text-xs text-muted-foreground mb-3">
                  Choose a template from Gupshup to auto-fill the form fields
                </p>
                
                {/* Search */}
                <div className="relative mb-3">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search Gupshup templates..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>

                {/* Template Selection */}
                <Select value={selectedGupshupTemplate?.id.toString() || ''} onValueChange={handleGupshupTemplateSelect}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a Gupshup template..." />
                  </SelectTrigger>
                  <SelectContent>
                    {isLoadingGupshup ? (
                      <div className="flex items-center justify-center p-4">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span className="ml-2">Loading templates...</span>
                      </div>
                    ) : gupshupError ? (
                      <div className="flex items-center justify-center p-4 text-red-600">
                        <AlertCircle className="w-4 h-4 mr-2" />
                        <span>Failed to load templates</span>
                      </div>
                    ) : (
                      filteredTemplates.map((template) => (
                        <SelectItem key={template.id} value={template.id.toString()}>
                          <div className="flex items-center space-x-2">
                            <span className="font-medium">{template.name}</span>
                            <Badge variant="outline" className="text-xs">
                              {template.category}
                            </Badge>
                          </div>
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              {/* Selected Template Preview */}
              {selectedGupshupTemplate && (
                <Card className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium text-sm">Selected Template</h4>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowGupshupPreview(!showGupshupPreview)}
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <Badge variant="outline">{selectedGupshupTemplate.category}</Badge>
                      <Badge variant="secondary">{selectedGupshupTemplate.language}</Badge>
                      <Badge variant={selectedGupshupTemplate.status === 'ENABLED' ? 'default' : 'secondary'}>
                        {selectedGupshupTemplate.status}
                      </Badge>
                    </div>
                    
                    {showGupshupPreview && (
                      <div className="mt-3 p-3 bg-muted rounded text-xs">
                        {selectedGupshupTemplate.header && (
                          <div className="font-medium mb-2">{selectedGupshupTemplate.header}</div>
                        )}
                        <div className="whitespace-pre-wrap">{selectedGupshupTemplate.body}</div>
                        {selectedGupshupTemplate.footer && (
                          <div className="text-muted-foreground mt-2">{selectedGupshupTemplate.footer}</div>
                        )}
                      </div>
                    )}
                  </div>
                </Card>
              )}
            </div>

            {/* Right Side - Template Form */}
            <div>
              {/* Read-only indicator when Gupshup template is selected */}
              {isGupshupTemplateSelected && (
                <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                      <span className="text-sm font-medium text-blue-800">
                        Using Gupshup Template: "{selectedGupshupTemplate?.name}"
                      </span>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSelectedGupshupTemplate(null);
                        form.reset({
                          selectedGupshupTemplate: '',
                          customName: '',
                          category: '',
                          language: 'en',
                          department: '',
                          body: '',
                          header: '',
                          footer: '',
                        });
                      }}
                      className="text-blue-600 hover:text-blue-800"
                    >
                      Clear & Create Custom
                    </Button>
                  </div>
                  <p className="text-xs text-blue-600 mt-1">
                    Template content is locked to ensure compatibility. Only the name can be customized.
                  </p>
                </div>
              )}
              
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="customName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          Template Name * 
                          {isGupshupTemplateSelected && (
                            <span className="text-xs text-muted-foreground ml-2">
                              (Custom name for this Gupshup template)
                            </span>
                          )}
                        </FormLabel>
                        <FormControl>
                          <Input 
                            placeholder={isGupshupTemplateSelected 
                              ? `Optional: Custom name (default: "${selectedGupshupTemplate?.name}")` 
                              : "Enter template name"
                            } 
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-3 gap-4">
                    <FormField
                      control={form.control}
                      name="category"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>
                            Category *
                            {isGupshupTemplateSelected && (
                              <span className="text-xs text-muted-foreground ml-2">(From Gupshup)</span>
                            )}
                          </FormLabel>
                          <FormControl>
                            {isGupshupTemplateSelected ? (
                              <Input 
                                value={field.value} 
                                readOnly 
                                className="bg-muted text-muted-foreground"
                              />
                            ) : (
                              <Select value={field.value} onValueChange={field.onChange}>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select category" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="marketing">Marketing</SelectItem>
                                  <SelectItem value="utility">Utility</SelectItem>
                                  <SelectItem value="authentication">Authentication</SelectItem>
                                  <SelectItem value="recruitment">Recruitment</SelectItem>
                                  <SelectItem value="interview">Interview</SelectItem>
                                  <SelectItem value="application">Application</SelectItem>
                                  <SelectItem value="offer">Offer</SelectItem>
                                  <SelectItem value="rejection">Rejection</SelectItem>
                                </SelectContent>
                              </Select>
                            )}
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="language"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>
                            Language *
                            {isGupshupTemplateSelected && (
                              <span className="text-xs text-muted-foreground ml-2">(From Gupshup)</span>
                            )}
                          </FormLabel>
                          <FormControl>
                            {isGupshupTemplateSelected ? (
                              <Input 
                                value={field.value} 
                                readOnly 
                                className="bg-muted text-muted-foreground"
                              />
                            ) : (
                              <Select value={field.value} onValueChange={field.onChange}>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select language" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="en">English</SelectItem>
                                  <SelectItem value="hi">Hindi</SelectItem>
                                  <SelectItem value="es">Spanish</SelectItem>
                                </SelectContent>
                              </Select>
                            )}
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="department"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Department (Optional)</FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="Enter department (optional)" 
                              {...field} 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="header"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          Header (Optional)
                          {isGupshupTemplateSelected && (
                            <span className="text-xs text-muted-foreground ml-2">(From Gupshup - Cannot be modified)</span>
                          )}
                        </FormLabel>
                        <FormControl>
                          <Input 
                            placeholder={isGupshupTemplateSelected ? "Header from Gupshup template" : "Enter header text"} 
                            {...field} 
                            readOnly={isGupshupTemplateSelected}
                            className={isGupshupTemplateSelected ? "bg-muted text-muted-foreground" : ""}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="body"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          Template Body *
                          {isGupshupTemplateSelected && (
                            <span className="text-xs text-red-600 ml-2">
                              ⚠️ (From Gupshup - Cannot be modified or template will break)
                            </span>
                          )}
                        </FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder={isGupshupTemplateSelected ? "Template body from Gupshup (read-only)" : "Enter template body with variables like {{name}}, {{1}}, etc."}
                            rows={6}
                            {...field}
                            readOnly={isGupshupTemplateSelected}
                            className={isGupshupTemplateSelected ? "bg-muted text-muted-foreground resize-none" : ""}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="footer"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          Footer (Optional)
                          {isGupshupTemplateSelected && (
                            <span className="text-xs text-muted-foreground ml-2">(From Gupshup - Cannot be modified)</span>
                          )}
                        </FormLabel>
                        <FormControl>
                          <Input 
                            placeholder={isGupshupTemplateSelected ? "Footer from Gupshup template" : "Enter footer text"} 
                            {...field} 
                            readOnly={isGupshupTemplateSelected}
                            className={isGupshupTemplateSelected ? "bg-muted text-muted-foreground" : ""}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Variables Display */}
                  {variables.length > 0 && (
                    <div>
                      <Label className="text-sm font-medium">Detected Variables</Label>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {variables.map((variable, index) => (
                          <Badge key={index} variant="secondary">
                            {variable}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </form>
              </Form>
            </div>
          </div>

          <Separator />

          <DialogFooter>
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button 
              onClick={form.handleSubmit(onSubmit)}
              disabled={saveTemplateMutation.isPending || createCustomMutation.isPending}
            >
              {(saveTemplateMutation.isPending || createCustomMutation.isPending) && (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              )}
              <Save className="w-4 h-4 mr-2" />
              {isGupshupTemplateSelected ? "Save Gupshup Template" : "Create Custom Template"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  } catch (error) {
    console.error('❌ Error rendering CreateTemplateModal:', error);
    return (
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Error Loading Template Modal</DialogTitle>
          </DialogHeader>
          <div className="p-4">
            <p className="text-sm text-muted-foreground mb-4">
              There was an error loading the template creation form. Please try refreshing the page.
            </p>
            <Button onClick={onClose} className="w-full">
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }
}; 