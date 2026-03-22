export interface MailgunMessage {
    /** The recipient email address(es). */
    to: string | string[];
  
    /** The sender email address. */
    from: string;
  
    /** The subject of the email. */
    subject: string;
  
    /** The text body of the email. */
    text?: string;
  
    /** The HTML body of the email. */
    html?: string;
  
    /** An array of file attachments. */
    attachment?: (string | Buffer | { data: string | Buffer; filename: string; contentType?: string })[];
  
    /** An array of inline images. */
    inline?: (string | Buffer | { data: string | Buffer; filename: string; contentType?: string })[];
  
    /** Custom headers to be included in the email. */
    'h:Reply-To'?: string;
    'h:Cc'?: string;
    'h:Bcc'?: string;
    [header: `h:${string}`]: string | undefined;
  
    /** Custom variables to be included in the email. */
    'v:my-var'?: any;
    'v:email-id'?: string;
    [variable: `v:${string}`]: any;
  
    /** Tag to be used for tracking. */
    'o:tag'?: string | string[];
  
    /** Campaign ID to be used for tracking. */
    'o:campaign'?: string | string[];
  
    /** Delivery time in seconds since epoch. */
    'o:deliverytime'?: number;
  
    /** Enable test mode. */
    'o:testmode'?: boolean;
  
    /** Enable tracking clicks. */
    'o:tracking-clicks'?: boolean;
  
    /** Enable tracking opens. */
    'o:tracking-opens'?: boolean;
  
    /** Require TLS for delivery. */
    'o:require-tls'?: boolean;
  
    /** Skip TLS for delivery. */
    'o:skip-tls'?: boolean;
  
    /** Custom DKIM selector. */
    'o:dkim'?: string;
  
    /** Custom MIME version. */
    'o:mime-version'?: string;
  
     /** Custom recipient variables. */
     'recipient-variables'?: { [recipient: string]: { [key: string]: any } };
  
      /** Template name. */
      template?: string;
  
      /** Template version. */
      't:version'?: string;
  
      /** Template text variables. */
      't:text'?: boolean;
  
      /** Template engine options. */
      't:variables'?: { [key: string]: any };
  
      /** Template inline CSS. */
      't:inline'?: boolean;
  
      /** Template keep headers. */
      't:keep-headers'?: boolean;
  
      /** Template tags. */
      't:tag'?: string | string[];
  
      /** Template campaign ID. */
      't:campaign'?: string | string[];
  }