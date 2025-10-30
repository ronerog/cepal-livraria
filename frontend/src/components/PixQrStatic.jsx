import React from "react";
import { Dialog, DialogContent, DialogTitle, Button, Box, Typography } from "@mui/material";

export default function PixQrStatic({ open, onClose }) {

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Pagamento via Pix</DialogTitle>
      <DialogContent>
        <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
          {/* Exibe a imagem fixa do QR */}
          <img
            src="/qrcode-pix.png"
            alt="QR Pix"
            style={{ width: 220, height: 220 }}
          />

          {/* Mostra o payload (opcional) */}
          <Typography variant="body2" sx={{ wordBreak: "break-all", fontSize: 12 }}>
            Companhia de Edição, Impressão e Publicação - CEPAL<br />
            CNPJ: 04.308.836/0001-09
          </Typography>

          {/* <Button
            variant="contained"
            onClick={() => navigator.clipboard.writeText("Companhia de Edição, Impressão e Publicação - CEPAL\nCNPJ: 04.308.836/0001-09")}
          >
            Copiar Código Pix
          </Button> */}
        </Box>
      </DialogContent>
    </Dialog>
  );
}
