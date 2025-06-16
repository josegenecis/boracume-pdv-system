
import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Edit, Settings } from 'lucide-react';

interface ProductCardProps {
  product: any;
  onEdit: (product: any) => void;
  onVariations: (product: any) => void;
}

const ProductCard: React.FC<ProductCardProps> = ({ product, onEdit, onVariations }) => {
  return (
    <Card className="overflow-hidden hover:shadow-md transition-shadow h-48"> {/* Reduzido de h-64 para h-48 */}
      <div className="relative h-24"> {/* Reduzido de h-32 para h-24 */}
        {product.image_url ? (
          <img
            src={product.image_url}
            alt={product.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-gray-100 flex items-center justify-center">
            <span className="text-gray-400 text-xs">Sem imagem</span> {/* Reduzido tamanho do texto */}
          </div>
        )}
        <div className="absolute top-1 right-1 flex gap-1"> {/* Reduzido espaçamento */}
          {!product.available && (
            <Badge variant="destructive" className="text-xs">Indisponível</Badge>
          )}
          {product.weight_based && (
            <Badge variant="secondary" className="text-xs">Por Peso</Badge>
          )}
        </div>
      </div>
      
      <CardContent className="p-3"> {/* Reduzido padding de p-4 para p-3 */}
        <div className="space-y-1"> {/* Reduzido espaçamento */}
          <h3 className="font-semibold text-sm leading-tight line-clamp-2"> {/* Reduzido tamanho da fonte */}
            {product.name}
          </h3>
          
          {product.description && (
            <p className="text-xs text-muted-foreground line-clamp-2"> {/* Reduzido tamanho da fonte */}
              {product.description}
            </p>
          )}
          
          <div className="flex items-center justify-between">
            <span className="text-lg font-bold text-green-600"> {/* Mantido tamanho do preço */}
              R$ {Number(product.price).toFixed(2)}
            </span>
          </div>
          
          <div className="flex gap-1 pt-1"> {/* Reduzido gap e padding */}
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => onEdit(product)}
              className="flex-1 h-7 text-xs" // Reduzido altura e tamanho da fonte
            >
              <Edit className="h-3 w-3 mr-1" />
              Editar
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => onVariations(product)}
              className="flex-1 h-7 text-xs" // Reduzido altura e tamanho da fonte
            >
              <Settings className="h-3 w-3 mr-1" />
              Variações
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default ProductCard;
