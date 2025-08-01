
import { useState } from 'react';
import { Search, Star, Loader2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { templateApi, LocalTemplate } from '@/lib/api';

interface TemplateSelectorProps {
  onSelectTemplate: (template: LocalTemplate) => void;
  onClose: () => void;
}

export const TemplateSelector = ({ onSelectTemplate, onClose }: TemplateSelectorProps) => {
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch approved templates from local database
  const {
    data: templatesData,
    isLoading,
    error
  } = useQuery({
    queryKey: ['templates', 'approved'],
    queryFn: () => templateApi.getLocalTemplates({ status: 'approved' }),
  });

  const templates = templatesData?.data?.templates || [];

  // Filter templates based on search query
  const filteredTemplates = templates.filter(template =>
    template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    template.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
    template.body.text.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Card className="absolute bottom-20 left-4 right-4 max-h-80 bg-card border shadow-lg z-10">
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-medium">Select Template</h3>
          <Button variant="ghost" size="sm" onClick={onClose}>
            ×
          </Button>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search templates..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>
      
      <div className="max-h-60 overflow-y-auto p-2">
        {isLoading && (
          <div className="flex items-center justify-center p-4">
            <Loader2 className="w-4 h-4 animate-spin mr-2" />
            <span className="text-sm text-muted-foreground">Loading templates...</span>
          </div>
        )}

        {error && (
          <Alert className="m-2">
            <AlertDescription>
              Failed to load templates. Please try again.
            </AlertDescription>
          </Alert>
        )}

        {!isLoading && !error && filteredTemplates.length === 0 && (
          <div className="text-center p-4 text-muted-foreground text-sm">
            {searchQuery ? 'No templates found matching your search.' : 'No templates available.'}
          </div>
        )}

        {!isLoading && !error && filteredTemplates.map((template) => (
          <div
            key={template._id}
            onClick={() => {
              onSelectTemplate(template);
              onClose();
            }}
            className="p-3 hover:bg-accent rounded cursor-pointer border-b border-border last:border-b-0"
          >
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center space-x-2">
                <h4 className="font-medium text-sm">{template.name}</h4>
                <Badge variant="outline" className="text-xs">
                  {template.language}
                </Badge>
              </div>
              <Badge variant="secondary" className="text-xs">
                {template.category}
              </Badge>
            </div>
            
            {/* Template Header */}
            {template.header && (
              <p className="text-xs text-muted-foreground mb-1 font-medium">
                📋 {template.header.content}
              </p>
            )}
            
            {/* Template Body */}
            <p className="text-xs text-muted-foreground mb-2 line-clamp-2">
              {template.body.text}
            </p>
            
            {/* Template Footer */}
            {template.footer && (
              <p className="text-xs text-muted-foreground mb-2 italic">
                {template.footer}
              </p>
            )}
            
            {/* Variables */}
            {template.body.variables && template.body.variables.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {template.body.variables.map((variable, index) => (
                  <Badge key={index} variant="outline" className="text-xs">
                    {`{{${variable}}}`}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
};
