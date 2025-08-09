import { useState } from 'react';
import { X, CheckCircle, XCircle, Clock, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Message } from '@/lib/api';

interface DeliveryInfoModalProps {
  message: Message | null;
  isOpen: boolean;
  onClose: () => void;
}

export const DeliveryInfoModal = ({ message, isOpen, onClose }: DeliveryInfoModalProps) => {
  if (!message) return null;

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'delivered':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'read':
        return <CheckCircle className="w-4 h-4 text-blue-500" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-500" />;
      case 'sent':
      default:
        return <Clock className="w-4 h-4 text-yellow-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'delivered':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'read':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'failed':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'sent':
      default:
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'delivered':
        return 'Delivered';
      case 'read':
        return 'Read';
      case 'failed':
        return 'Failed';
      case 'sent':
      default:
        return 'Sent';
    }
  };

  const formatTimestamp = (timestamp: string | Date) => {
    const date = new Date(timestamp);
    return {
      date: date.toLocaleDateString(),
      time: date.toLocaleTimeString(),
      full: date.toLocaleString()
    };
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Info className="w-5 h-5" />
            <span>Delivery Information</span>
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Message Preview */}
          <div className="p-3 bg-muted rounded-lg">
            <p className="text-sm font-medium mb-1">Message Preview:</p>
            <p className="text-sm text-muted-foreground">
              {message.type === 'template' && message.content.header && (
                <span className="block mb-1">📋 {message.content.header}</span>
              )}
              {message.content.text ? (
                <span className="whitespace-pre-wrap">{message.content.text}</span>
              ) : (
                <span className="italic">Template message</span>
              )}
              {message.type === 'template' && message.content.footer && (
                <span className="block mt-1 text-xs">📝 {message.content.footer}</span>
              )}
            </p>
          </div>

          {/* Delivery Status */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Status:</span>
              <Badge className={`${getStatusColor(message.status)} border`}>
                <span className="flex items-center space-x-1">
                  {getStatusIcon(message.status)}
                  <span>{getStatusText(message.status)}</span>
                </span>
              </Badge>
            </div>

            {/* Message Details */}
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Message ID:</span>
                <span className="font-mono text-xs">{message.messageId}</span>
              </div>
              
              <div className="flex justify-between">
                <span className="text-muted-foreground">Type:</span>
                <span className="capitalize">{message.type}</span>
              </div>
              
              <div className="flex justify-between">
                <span className="text-muted-foreground">Direction:</span>
                <span className="capitalize">{message.direction}</span>
              </div>
              
              <div className="flex justify-between">
                <span className="text-muted-foreground">Sent:</span>
                <span>{formatTimestamp(message.timestamp).full}</span>
              </div>
            </div>

            {/* Template Information */}
            {message.type === 'template' && (
              <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                <p className="text-sm font-medium text-blue-800 mb-2">Template Details:</p>
                <div className="space-y-1 text-xs text-blue-700">
                  {message.content.templateId && (
                    <div className="flex justify-between">
                      <span>Template ID:</span>
                      <span className="font-mono">{message.content.templateId}</span>
                    </div>
                  )}
                  {message.content.header && (
                    <div className="flex justify-between">
                      <span>Header:</span>
                      <span className="text-right">{message.content.header}</span>
                    </div>
                  )}
                  {message.content.footer && (
                    <div className="flex justify-between">
                      <span>Footer:</span>
                      <span className="text-right">{message.content.footer}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Status Timeline */}
            <div className="p-3 bg-gray-50 rounded-lg border">
              <p className="text-sm font-medium mb-2">Status Timeline:</p>
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <CheckCircle className="w-3 h-3 text-green-500" />
                  <span className="text-xs">Message sent at {formatTimestamp(message.timestamp).time}</span>
                </div>
                {message.status === 'delivered' && (
                  <div className="flex items-center space-x-2">
                    <CheckCircle className="w-3 h-3 text-green-500" />
                    <span className="text-xs">Delivered to recipient</span>
                  </div>
                )}
                {message.status === 'read' && (
                  <div className="flex items-center space-x-2">
                    <CheckCircle className="w-3 h-3 text-blue-500" />
                    <span className="text-xs">Read by recipient</span>
                  </div>
                )}
                {message.status === 'failed' && (
                  <div className="flex items-center space-x-2">
                    <XCircle className="w-3 h-3 text-red-500" />
                    <span className="text-xs">Delivery failed</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}; 