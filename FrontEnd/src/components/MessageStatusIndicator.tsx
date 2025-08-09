import { Check, CheckCheck, Clock, XCircle } from 'lucide-react';

interface MessageStatusIndicatorProps {
  status: 'sent' | 'delivered' | 'read' | 'failed';
  className?: string;
}

export const MessageStatusIndicator = ({ status, className = "w-4 h-4" }: MessageStatusIndicatorProps) => {
  switch (status) {
    case 'sent':
      return <Clock className={`${className} text-gray-400`} title="Sent" />;
    case 'delivered':
      return <CheckCheck className={`${className} text-gray-400`} title="Delivered" />;
    case 'read':
      return <CheckCheck className={`${className} text-blue-500`} title="Read" />;
    case 'failed':
      return <XCircle className={`${className} text-red-500`} title="Failed" />;
    default:
      return <Clock className={`${className} text-gray-400`} title="Sending" />;
  }
};

// Alternative component with single/double tick design
export const MessageTickIndicator = ({ status, className = "w-4 h-4" }: MessageStatusIndicatorProps) => {
  switch (status) {
    case 'sent':
      return (
        <div className={`${className} flex items-center justify-center`} title="Sent">
          <Check className="w-3 h-3 text-gray-400" />
        </div>
      );
    case 'delivered':
      return (
        <div className={`${className} flex items-center justify-center relative`} title="Delivered">
          <Check className="w-3 h-3 text-gray-400" />
          <Check className="w-3 h-3 text-gray-400 -ml-1.5" />
        </div>
      );
    case 'read':
      return (
        <div className={`${className} flex items-center justify-center relative`} title="Read">
          <Check className="w-3 h-3 text-blue-500" />
          <Check className="w-3 h-3 text-blue-500 -ml-1.5" />
        </div>
      );
    case 'failed':
      return <XCircle className={`${className} text-red-500`} title="Failed" />;
    default:
      return <Clock className={`${className} text-gray-400`} title="Sending" />;
  }
};