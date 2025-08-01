import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, Plus, Star, Edit, Trash2, Eye, FileText, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';

import { templateApi, LocalTemplate } from '@/lib/api';
import { CreateTemplateModal } from './CreateTemplateModal';

export const TemplateManager = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedDepartment, setSelectedDepartment] = useState('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  
  const queryClient = useQueryClient();

  // Fetch local templates
  const { 
    data: templatesData, 
    isLoading: isLoadingTemplates, 
    error: templatesError 
  } = useQuery({
    queryKey: ['localTemplates', { 
      category: selectedCategory !== 'all' ? selectedCategory : undefined,
      department: selectedDepartment !== 'all' ? selectedDepartment : undefined,
    }],
    queryFn: () => templateApi.getLocalTemplates({ 
      category: selectedCategory !== 'all' ? selectedCategory : undefined,
      department: selectedDepartment !== 'all' ? selectedDepartment : undefined,
    }),
    retry: 2,
  });

  // Fetch local template categories
  const { 
    data: categoriesData, 
    error: categoriesError 
  } = useQuery({
    queryKey: ['localTemplateCategories'],
    queryFn: () => templateApi.getLocalTemplateCategories(),
    retry: 2,
  });

  // Delete template mutation
  const deleteTemplateMutation = useMutation({
    mutationFn: (templateId: string) => templateApi.deleteLocalTemplate(templateId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['localTemplates'] });
      toast.success('Template deleted successfully');
    },
    onError: (error: any) => {
      const errorMessage = error.response?.data?.message || error.message || 'Failed to delete template';
      toast.error(errorMessage);
    },
  });

  // Safe data extraction with fallbacks
  const templates = templatesData?.data?.templates || [];
  const categories = ['all', ...(categoriesData?.data?.categories || [])];

  const filteredTemplates = templates.filter(template => {
    const matchesSearch = template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         template.body.text.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         template.category.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || template.category === selectedCategory;
    const matchesDepartment = selectedDepartment === 'all' || template.department === selectedDepartment;
    
    return matchesSearch && matchesCategory && matchesDepartment;
  });

  const handleDeleteTemplate = (templateId: string) => {
    if (window.confirm('Are you sure you want to delete this template?')) {
      deleteTemplateMutation.mutate(templateId);
    }
  };

  const TemplatePreviewDialog = ({ template }: { template: LocalTemplate }) => (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">
          <Eye className="w-4 h-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Template Preview: {template.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label className="text-sm font-medium">Category</Label>
            <Badge variant="outline" className="ml-2">{template.category}</Badge>
          </div>

          <div>
            <Label className="text-sm font-medium">Language</Label>
            <Badge variant="outline" className="ml-2">{template.language}</Badge>
          </div>

          {template.header && (
            <div>
              <Label className="text-sm font-medium">Header</Label>
              <div className="mt-2 p-3 bg-muted rounded-lg">
                <p className="text-sm font-medium">{template.header.content}</p>
              </div>
            </div>
          )}

          <div>
            <Label className="text-sm font-medium">Template Body</Label>
            <div className="mt-2 p-4 bg-muted rounded-lg">
              <p className="text-sm whitespace-pre-wrap">{template.body.text}</p>
            </div>
          </div>

          {template.footer && (
            <div>
              <Label className="text-sm font-medium">Footer</Label>
              <div className="mt-2 p-3 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">{template.footer}</p>
              </div>
            </div>
          )}

          <div>
            <Label className="text-sm font-medium">Variables</Label>
            <div className="flex flex-wrap gap-2 mt-2">
              {template.body.variables.map((variable: string, index: number) => (
                <Badge key={index} variant="secondary">{variable}</Badge>
              ))}
            </div>
          </div>

          <div>
            <Label className="text-sm font-medium">Sample Preview</Label>
            <div className="mt-2 p-4 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-sm whitespace-pre-wrap">
                {template.body.text.replace(/\{\{(\w+|\d+)\}\}/g, (match: string, key: string) => {
                  const samples: Record<string, string> = {
                    '1': 'John Doe',
                    '2': 'Software Engineer',
                    '3': 'EarlyJobs',
                    '4': 'March 15, 2024',
                    '5': '2:00 PM',
                    '6': 'New York Office',
                    '7': '+1-555-0123',
                    '8': 'hr@earlyjobs.com',
                    name: 'John Doe',
                    jobTitle: 'Software Engineer',
                    position: 'Product Manager',
                    company: 'EarlyJobs',
                    salary: '$75,000',
                    location: 'New York',
                    date: 'March 15, 2024',
                    time: '2:00 PM',
                    platform: 'Google Meet',
                    timeframe: '5-7 business days',
                    startDate: 'April 1, 2024'
                  };
                  return samples[key] || `[${key}]`;
                })}
              </p>
            </div>
          </div>

          <div className="text-xs text-muted-foreground">
            <p>Template ID: {template.templateId}</p>
            <p>Created: {new Date(template.createdAt).toLocaleDateString()}</p>
            <p>Updated: {new Date(template.updatedAt).toLocaleDateString()}</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );

  // Show error state if there are critical errors
  if (templatesError) {
    return (
      <div className="h-full p-6 overflow-y-auto">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-foreground mb-2">Template Management</h2>
              <p className="text-muted-foreground">Manage your WhatsApp message templates</p>
            </div>
            <Button onClick={() => setShowCreateModal(true)}>
              <Plus className="w-4 h-4 mr-2" />
              New Template
            </Button>
          </div>

          <Alert className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Failed to load templates: {(templatesError as any)?.message || 'Unknown error'}
              <Button 
                variant="outline" 
                size="sm" 
                className="ml-4"
                onClick={() => queryClient.invalidateQueries({ queryKey: ['localTemplates'] })}
              >
                Retry
              </Button>
            </AlertDescription>
          </Alert>

        </div>
      </div>
    );
  }

  return (
    <div className="h-full p-6 overflow-y-auto">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-foreground mb-2">Template Management</h2>
            <p className="text-muted-foreground">Manage your WhatsApp message templates</p>
          </div>
          <Button onClick={() => setShowCreateModal(true)}>
            <Plus className="w-4 h-4 mr-2" />
            New Template
          </Button>
        </div>

        {/* Show categories error if present */}
        {categoriesError && (
          <Alert className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Failed to load categories: {(categoriesError as any)?.message || 'Unknown error'}
            </AlertDescription>
          </Alert>
        )}

        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search templates..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger>
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent>
              {categories.map((category) => (
                <SelectItem key={category} value={category}>
                  {category.charAt(0).toUpperCase() + category.slice(1)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
            <SelectTrigger>
              <SelectValue placeholder="All Departments" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Departments</SelectItem>
              <SelectItem value="sales">Sales</SelectItem>
              <SelectItem value="hr">Human Resources</SelectItem>
              <SelectItem value="it">IT</SelectItem>
              <SelectItem value="marketing">Marketing</SelectItem>
              <SelectItem value="finance">Finance</SelectItem>
              <SelectItem value="operations">Operations</SelectItem>
              <SelectItem value="support">Customer Support</SelectItem>
            </SelectContent>
          </Select>

          <div className="col-span-2 text-sm text-muted-foreground flex items-center justify-between">
            <span>{filteredTemplates.length} template{filteredTemplates.length !== 1 ? 's' : ''} found</span>
            {isLoadingTemplates && (
              <div className="flex items-center">
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                Loading...
              </div>
            )}
          </div>
        </div>

        {/* Templates Grid */}
        {isLoadingTemplates ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin mr-3" />
            <span>Loading templates...</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredTemplates.map((template) => (
              <Card key={template._id} className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center space-x-2">
                    <h3 className="font-semibold text-sm">{template.name}</h3>
                  </div>
                  <Badge variant="default" className="text-xs">
                    Ready
                  </Badge>
                </div>

                <p className="text-xs text-muted-foreground mb-3 line-clamp-3">
                  {template.body.text}
                </p>

                <div className="flex flex-wrap gap-1 mb-3">
                  {template.body.variables.slice(0, 3).map((variable, index) => (
                    <Badge key={index} variant="outline" className="text-xs">
                      {variable}
                    </Badge>
                  ))}
                  {template.body.variables.length > 3 && (
                    <Badge variant="outline" className="text-xs">
                      +{template.body.variables.length - 3} more
                    </Badge>
                  )}
                </div>

                <div className="flex items-center justify-between text-xs text-muted-foreground mb-4">
                  <span>Language: {template.language}</span>
                  <span>{new Date(template.createdAt).toLocaleDateString()}</span>
                </div>

                <div className="flex items-center justify-between mb-2">
                  <Badge variant="outline" className="text-xs">
                    {template.category}
                  </Badge>
                  {template.department && (
                    <Badge variant="secondary" className="text-xs">
                      {template.department}
                    </Badge>
                  )}
                </div>

                <div className="flex items-center space-x-1">
                  <TemplatePreviewDialog template={template} />
                  <Button variant="ghost" size="sm">
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => handleDeleteTemplate(template._id)}
                    disabled={deleteTemplateMutation.isPending}
                  >
                    {deleteTemplateMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}

        {!isLoadingTemplates && filteredTemplates.length === 0 && (
          <div className="text-center py-12">
            <FileText className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">No templates found</h3>
            <p className="text-muted-foreground mb-4">
              {templates.length === 0 
                ? "You haven't created any templates yet" 
                : "Try adjusting your search or filters"}
            </p>
            <Button onClick={() => setShowCreateModal(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Create Your First Template
            </Button>
          </div>
        )}
      </div>

      {/* Create Template Modal */}
      <CreateTemplateModal 
        open={showCreateModal} 
        onClose={() => setShowCreateModal(false)} 
      />
    </div>
  );
};
