
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

interface MessagePreviewProps {
  template: any;
  variables: Record<string, string>;
  onClose: () => void;
}

export const MessagePreview = ({ template, variables, onClose }: MessagePreviewProps) => {
  const previewText = template.content.replace(/\{\{(\w+)\}\}/g, (match: string, key: string) => {
    return variables[key] || `{{${key}}}`;
  });

  return (
    <Card className="p-4 mb-4 bg-blue-50 border-blue-200">
      <div className="flex justify-between items-start mb-2">
        <h4 className="font-medium text-sm">Template Preview: {template.name}</h4>
        <Button variant="ghost" size="sm" onClick={onClose}>
          <X className="w-4 h-4" />
        </Button>
      </div>
      <div className="bg-white p-3 rounded border text-sm">
        {previewText}
      </div>
    </Card>
  );
};
