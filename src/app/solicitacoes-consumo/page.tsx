'use client';

import {
    useCallback,
    useEffect,
    useMemo,
    useState,
    type FormEvent,
    type ReactNode,
} from 'react';
import { useRouter } from 'next/navigation';

const API_URL = (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/+$/, '');

type Aba = 'mesas' | 'solicitacoes';
type TipoAtendimento = 'MESA' | 'BALCAO';
type FiltroMesa = 'TODAS' | 'LIVRES' | 'ATENDIMENTO' | 'INATIVAS';

type Resposta<T> = {
    status: boolean | string;
    message?: string;
    dados?: T;
};

type Mesa = {
    id: string;
    numero: string | number;
    codigo_qr?: string;
    status: string;
};

type Produto = {
    id: string;
    nome: string;
    descricao?: string | null;
    preco: string | number;
    ativo: boolean | number | string;
};

type Comanda = {
    id: string;
    codigo: string;
    tipo: TipoAtendimento;
    cliente_nome?: string | null;
    mesa_id?: string | null;
    mesa_numero?: string | number | null;
    status: string;
    subtotal: string | number;
    taxa_servico?: string | number;
    desconto?: string | number;
    total: string | number;
    aberta_em?: string;
    fechada_em?: string | null;
    created_at?: string;
    observacao?: string | null;
};

type ItemComanda = {
    id: string;
    produto_id?: string | null;
    produto_nome: string;
    preco_unitario: string | number;
    quantidade: number;
    subtotal: string | number;
    observacao?: string | null;
    status?: string;
    created_at?: string;
};

type PagamentoComanda = {
    id: string;
    valor: string | number;
    forma_pagamento: string;
    status: string;
    observacao?: string | null;
    registrado_por?: string | null;
    created_at?: string;
};

type ComandaDetalhe = Comanda & {
    estabelecimento_id?: string;
    itens?: ItemComanda[];
    pagamentos?: PagamentoComanda[];
    total_pago?: string | number;
    saldo_devedor?: string | number;
};

type ItemSolicitacao = {
    id: string;
    produto_id?: string | null;
    produto_nome: string;
    preco_unitario: string | number;
    quantidade: number;
    subtotal: string | number;
    observacao: string | null;
};

type Solicitacao = {
    id: string;
    mesa_id: string;
    mesa_numero?: string | number | null;
    cliente_nome: string | null;
    observacao: string | null;
    status: 'PENDENTE' | 'CONFIRMADA' | 'REJEITADA';
    created_at: string;
    itens?: ItemSolicitacao[];
};

type ItemCarrinho = {
    chave: string;
    produto_id: string;
    produto_nome: string;
    preco: number;
    quantidade: number;
    observacao: string;
};

const inputClass =
    'min-h-12 w-full rounded-xl border border-white/10 bg-[#101310] px-3 text-sm text-white outline-none transition placeholder:text-gray-500 focus:border-[#65D69A]/70';

const secondaryButtonClass =
    'min-h-11 rounded-xl border border-white/10 px-3 text-sm font-semibold text-gray-200 transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40';

function formatarMoeda(valor: string | number) {
    return Number(valor || 0).toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL',
    });
}

function formatarData(data?: string | null) {
    if (!data) return '—';

    const dataValida = new Date(data);

    if (Number.isNaN(dataValida.getTime())) {
        return data;
    }

    return dataValida.toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

function validarLista<T>(
    resposta: Resposta<T[]>,
    mensagem: string
): T[] {
    if (resposta.status === false || !Array.isArray(resposta.dados)) {
        throw new Error(resposta.message || mensagem);
    }

    return resposta.dados;
}

function BotaoIcone({
    children,
    onClick,
    label,
    disabled = false,
}: {
    children: ReactNode;
    onClick: () => void;
    label: string;
    disabled?: boolean;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            aria-label={label}
            title={label}
            className="flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] text-gray-200 transition hover:bg-white/10 disabled:opacity-40"
        >
            {children}
        </button>
    );
}

function rotuloFormaPagamento(forma: string) {
    const formas: Record<string, string> = {
        DINHEIRO: 'Dinheiro',
        PIX: 'Pix',
        CARTAO_CREDITO: 'Cartão de crédito',
        CARTAO_DEBITO: 'Cartão de débito',
        TRANSFERENCIA: 'Transferência',
        OUTRO: 'Outro',
    };

    return formas[forma] || forma.replace(/_/g, ' ');
}

export default function SolicitacoesConsumoPage() {
    const router = useRouter();

    const [aba, setAba] = useState<Aba>('mesas');

    const [mesas, setMesas] = useState<Mesa[]>([]);
    const [produtos, setProdutos] = useState<Produto[]>([]);
    const [comandas, setComandas] = useState<Comanda[]>([]);
    const [solicitacoes, setSolicitacoes] = useState<Solicitacao[]>([]);

    const [carregando, setCarregando] = useState(true);
    const [atualizando, setAtualizando] = useState(false);
    const [acaoEmAndamento, setAcaoEmAndamento] = useState<string | null>(
        null
    );

    const [erro, setErro] = useState('');
    const [mensagem, setMensagem] = useState('');

    // Busca e filtros das mesas
    const [pesquisaMesa, setPesquisaMesa] = useState('');
    const [filtroMesa, setFiltroMesa] = useState<FiltroMesa>('TODAS');

    // Modal de lançamento manual
    const [modalAberto, setModalAberto] = useState(false);
    const [tipoAtendimento, setTipoAtendimento] =
        useState<TipoAtendimento>('MESA');
    const [mesaSelecionadaId, setMesaSelecionadaId] = useState('');
    const [comandaBalcaoId, setComandaBalcaoId] = useState('');
    const [clienteNome, setClienteNome] = useState('');
    const [observacaoAbertura, setObservacaoAbertura] = useState('');

    const [produtoSelecionadoId, setProdutoSelecionadoId] = useState('');
    const [quantidadeAdicionar, setQuantidadeAdicionar] = useState(1);
    const [observacaoItem, setObservacaoItem] = useState('');
    const [carrinho, setCarrinho] = useState<ItemCarrinho[]>([]);

    const [lancandoConsumo, setLancandoConsumo] = useState(false);
    const [revisaoNecessaria, setRevisaoNecessaria] = useState(false);
    const [revisaoConfirmada, setRevisaoConfirmada] = useState(false);

    // Modal de consulta da comanda
    const [modalComandaAberto, setModalComandaAberto] = useState(false);
    const [comandaSelecionadaId, setComandaSelecionadaId] = useState('');
    const [comandaDetalhe, setComandaDetalhe] =
        useState<ComandaDetalhe | null>(null);
    const [carregandoDetalhe, setCarregandoDetalhe] = useState(false);
    const [erroDetalhe, setErroDetalhe] = useState('');

    const sair = useCallback(() => {
        sessionStorage.removeItem('menuvivo_token');
        sessionStorage.removeItem('menuvivo_usuario');
        router.replace('/login');
    }, [router]);

    const requisicao = useCallback(
        async <T,>(
            caminho: string,
            opcoes: RequestInit = {}
        ): Promise<T> => {
            const token = sessionStorage.getItem('menuvivo_token');

            if (!token) {
                sair();
                throw new Error('Sua sessão expirou. Entre novamente.');
            }

            if (!API_URL) {
                throw new Error(
                    'A URL da API não está configurada em NEXT_PUBLIC_API_URL.'
                );
            }

            const resposta = await fetch(`${API_URL}${caminho}`, {
                ...opcoes,
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                    ...(opcoes.headers as Record<string, string> | undefined),
                },
                cache: 'no-store',
            });

            const dados = await resposta.json().catch(() => null);

            if (resposta.status === 401 || resposta.status === 403) {
                sair();

                throw new Error(
                    dados?.message ||
                        'Sessão inválida ou acesso não autorizado.'
                );
            }

            if (!resposta.ok) {
                throw new Error(
                    dados?.message || 'Não foi possível concluir a operação.'
                );
            }

            return dados as T;
        },
        [sair]
    );

    const carregarPainel = useCallback(
        async (silencioso = false) => {
            if (silencioso) {
                setAtualizando(true);
            } else {
                setCarregando(true);
                setErro('');
            }

            try {
                const [
                    respostaMesas,
                    respostaProdutos,
                    respostaComandas,
                    respostaSolicitacoes,
                ] = await Promise.all([
                    requisicao<Resposta<Mesa[]>>('/mesas'),
                    requisicao<Resposta<Produto[]>>('/produtos?ativo=1'),
                    requisicao<Resposta<Comanda[]>>('/comandas?status=ABERTA'),
                    requisicao<Resposta<Solicitacao[]>>(
                        '/solicitacoes-consumo?status=PENDENTE'
                    ),
                ]);

                setMesas(
                    validarLista(respostaMesas, 'Erro ao carregar as mesas.')
                );

                const listaProdutos = validarLista(
                    respostaProdutos,
                    'Erro ao carregar os produtos.'
                );

                setProdutos(
                    listaProdutos.filter(
                        (produto) =>
                            produto.ativo === true ||
                            produto.ativo === 1 ||
                            produto.ativo === '1'
                    )
                );

                setComandas(
                    validarLista(
                        respostaComandas,
                        'Erro ao carregar as comandas abertas.'
                    )
                );

                setSolicitacoes(
                    validarLista(
                        respostaSolicitacoes,
                        'Erro ao carregar as solicitações pendentes.'
                    )
                );
            } catch (error) {
                setErro(
                    error instanceof Error
                        ? error.message
                        : 'Não foi possível carregar o painel.'
                );
            } finally {
                setCarregando(false);
                setAtualizando(false);
            }
        },
        [requisicao]
    );

    useEffect(() => {
        if (!sessionStorage.getItem('menuvivo_token')) {
            router.replace('/login');
            return;
        }

        void carregarPainel();

        const intervalo = window.setInterval(() => {
            void carregarPainel(true);
        }, 15000);

        return () => window.clearInterval(intervalo);
    }, [carregarPainel, router]);

    // Mantém o fundo sem rolagem quando um modal estiver aberto.
    useEffect(() => {
        if (!modalAberto && !modalComandaAberto) return;

        const overflowAnterior = document.body.style.overflow;
        document.body.style.overflow = 'hidden';

        return () => {
            document.body.style.overflow = overflowAnterior;
        };
    }, [modalAberto, modalComandaAberto]);

    // Fecha o modal de lançamento com Escape.
    useEffect(() => {
        if (!modalAberto) return;

        const tratarTecla = (event: KeyboardEvent) => {
            if (event.key !== 'Escape' || lancandoConsumo) return;

            if (
                carrinho.length > 0 &&
                !window.confirm(
                    'Fechar o lançamento? Os itens ainda não enviados serão perdidos.'
                )
            ) {
                return;
            }

            setModalAberto(false);
        };

        window.addEventListener('keydown', tratarTecla);

        return () => window.removeEventListener('keydown', tratarTecla);
    }, [modalAberto, lancandoConsumo, carrinho.length]);

    const comandasAbertas = useMemo(
        () => comandas.filter((comanda) => comanda.status === 'ABERTA'),
        [comandas]
    );

    const mesasAtivas = useMemo(
        () => mesas.filter((mesa) => mesa.status === 'ATIVA'),
        [mesas]
    );

    const totalEmComandas = useMemo(
        () =>
            comandasAbertas.reduce(
                (soma, comanda) => soma + Number(comanda.total || 0),
                0
            ),
        [comandasAbertas]
    );

    const totalCarrinho = useMemo(
        () =>
            carrinho.reduce(
                (soma, item) => soma + item.preco * item.quantidade,
                0
            ),
        [carrinho]
    );

    const mesasVisiveis = useMemo(() => {
        const termo = pesquisaMesa.trim().toLowerCase();

        return mesas
            .filter((mesa) => {
                const comanda = comandasAbertas.find(
                    (item) =>
                        item.tipo === 'MESA' && item.mesa_id === mesa.id
                );

                const inativa = mesa.status !== 'ATIVA';

                if (filtroMesa === 'LIVRES' && (inativa || comanda)) {
                    return false;
                }

                if (filtroMesa === 'ATENDIMENTO' && (inativa || !comanda)) {
                    return false;
                }

                if (filtroMesa === 'INATIVAS' && !inativa) {
                    return false;
                }

                if (
                    termo &&
                    !String(mesa.numero).toLowerCase().includes(termo)
                ) {
                    return false;
                }

                return true;
            })
            .sort((a, b) => Number(a.numero) - Number(b.numero));
    }, [mesas, comandasAbertas, filtroMesa, pesquisaMesa]);

    function limparFormulario() {
        setClienteNome('');
        setObservacaoAbertura('');
        setProdutoSelecionadoId('');
        setQuantidadeAdicionar(1);
        setObservacaoItem('');
        setCarrinho([]);
        setComandaBalcaoId('');
        setRevisaoNecessaria(false);
        setRevisaoConfirmada(false);
    }

    function abrirLancamento(
        tipo: TipoAtendimento = 'MESA',
        mesaId = ''
    ) {
        limparFormulario();
        setTipoAtendimento(tipo);
        setMesaSelecionadaId(mesaId);
        setErro('');
        setMensagem('');
        setModalAberto(true);
    }

    function fecharModalLancamento() {
        if (lancandoConsumo) return;

        if (
            carrinho.length > 0 &&
            !window.confirm(
                'Fechar o lançamento? Os itens ainda não enviados serão perdidos.'
            )
        ) {
            return;
        }

        setModalAberto(false);
    }

    function mudarTipoAtendimento(tipo: TipoAtendimento) {
        setTipoAtendimento(tipo);

        if (tipo === 'MESA') {
            setComandaBalcaoId('');
        } else {
            setMesaSelecionadaId('');
        }
    }

    function adicionarProdutoAoCarrinho() {
        setErro('');
        setMensagem('');

        const produto = produtos.find(
            (item) => item.id === produtoSelecionadoId
        );

        if (!produto) {
            setErro('Selecione um produto.');
            return;
        }

        if (
            !Number.isInteger(quantidadeAdicionar) ||
            quantidadeAdicionar < 1 ||
            quantidadeAdicionar > 999
        ) {
            setErro('Informe uma quantidade entre 1 e 999.');
            return;
        }

        setCarrinho((itens) => [
            ...itens,
            {
                chave: `${produto.id}-${Date.now()}-${Math.random()
                    .toString(16)
                    .slice(2)}`,
                produto_id: produto.id,
                produto_nome: produto.nome,
                preco: Number(produto.preco || 0),
                quantidade: quantidadeAdicionar,
                observacao: observacaoItem.trim(),
            },
        ]);

        setProdutoSelecionadoId('');
        setQuantidadeAdicionar(1);
        setObservacaoItem('');
    }

    function alterarQuantidadeItem(chave: string, quantidade: number) {
        if (
            !Number.isInteger(quantidade) ||
            quantidade < 1 ||
            quantidade > 999
        ) {
            return;
        }

        setCarrinho((itens) =>
            itens.map((item) =>
                item.chave === chave ? { ...item, quantidade } : item
            )
        );
    }

    function alterarObservacaoItem(chave: string, observacao: string) {
        setCarrinho((itens) =>
            itens.map((item) =>
                item.chave === chave ? { ...item, observacao } : item
            )
        );
    }

    function removerItemCarrinho(chave: string) {
        setCarrinho((itens) => itens.filter((item) => item.chave !== chave));
    }

    async function lancarConsumo(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();

        setErro('');
        setMensagem('');

        if (carrinho.length === 0) {
            setErro('Adicione pelo menos um produto.');
            return;
        }

        if (tipoAtendimento === 'MESA') {
            const mesa = mesas.find(
                (item) => item.id === mesaSelecionadaId
            );

            if (!mesa) {
                setErro('Selecione uma mesa.');
                return;
            }

            if (mesa.status !== 'ATIVA') {
                setErro('Esta mesa está inativa.');
                return;
            }
        }

        if (revisaoNecessaria && !revisaoConfirmada) {
            setErro(
                'Confira a comanda antes de continuar, para evitar lançar itens duplicados.'
            );
            return;
        }

        setLancandoConsumo(true);

        let comandaId = '';
        let codigoComanda = '';
        let itensConfirmados = 0;

        try {
            // Atualiza a lista antes de decidir abrir uma nova comanda.
            const respostaAtual = await requisicao<Resposta<Comanda[]>>(
                '/comandas?status=ABERTA'
            );

            const abertasAtuais = validarLista(
                respostaAtual,
                'Não foi possível verificar as comandas abertas.'
            );

            setComandas(abertasAtuais);

            if (tipoAtendimento === 'MESA') {
                const existente = abertasAtuais.find(
                    (comanda) =>
                        comanda.status === 'ABERTA' &&
                        comanda.tipo === 'MESA' &&
                        comanda.mesa_id === mesaSelecionadaId
                );

                if (existente) {
                    comandaId = existente.id;
                    codigoComanda = existente.codigo;
                }
            } else if (comandaBalcaoId) {
                const existente = abertasAtuais.find(
                    (comanda) =>
                        comanda.id === comandaBalcaoId &&
                        comanda.tipo === 'BALCAO' &&
                        comanda.status === 'ABERTA'
                );

                if (existente) {
                    comandaId = existente.id;
                    codigoComanda = existente.codigo;
                }
            }

            // Só abre uma comanda caso ainda não exista uma adequada.
            if (!comandaId) {
                const dadosAbertura =
                    tipoAtendimento === 'MESA'
                        ? {
                              tipo: 'MESA',
                              mesa_id: mesaSelecionadaId,
                              cliente_nome: clienteNome.trim() || null,
                              observacao: observacaoAbertura.trim() || null,
                          }
                        : {
                              tipo: 'BALCAO',
                              cliente_nome: clienteNome.trim() || null,
                              observacao: observacaoAbertura.trim() || null,
                          };

                const respostaAbertura = await requisicao<Resposta<Comanda>>(
                    '/comandas',
                    {
                        method: 'POST',
                        body: JSON.stringify(dadosAbertura),
                    }
                );

                if (
                    respostaAbertura.status === false ||
                    !respostaAbertura.dados?.id
                ) {
                    throw new Error(
                        respostaAbertura.message ||
                            'Não foi possível abrir a comanda.'
                    );
                }

                comandaId = respostaAbertura.dados.id;
                codigoComanda = respostaAbertura.dados.codigo;
            }

            // Cada item é validado novamente pelo backend.
            for (const item of carrinho) {
                const respostaItem = await requisicao<Resposta<unknown>>(
                    `/comandas/${encodeURIComponent(comandaId)}/itens`,
                    {
                        method: 'POST',
                        body: JSON.stringify({
                            produto_id: item.produto_id,
                            quantidade: item.quantidade,
                            observacao: item.observacao.trim() || null,
                        }),
                    }
                );

                if (respostaItem.status === false) {
                    throw new Error(
                        respostaItem.message ||
                            `Falha ao lançar ${item.produto_nome}.`
                    );
                }

                itensConfirmados += 1;
            }

            setMensagem(
                `${carrinho.length} item(ns) lançado(s) na comanda ${codigoComanda || comandaId}.`
            );

            limparFormulario();
            setModalAberto(false);
            setAba('mesas');

            await carregarPainel(true);
        } catch (error) {
            const detalhe =
                error instanceof Error
                    ? error.message
                    : 'Erro desconhecido ao lançar o consumo.';

            if (itensConfirmados > 0) {
                setCarrinho((itens) => itens.slice(itensConfirmados));
                setRevisaoNecessaria(true);
                setRevisaoConfirmada(false);

                setErro(
                    `${itensConfirmados} item(ns) tiveram confirmação de lançamento na comanda ${codigoComanda || comandaId}. Confira a comanda antes de continuar com os itens restantes. Verifique também se o último item foi registrado, caso a conexão tenha falhado. Detalhe: ${detalhe}`
                );
            } else if (comandaId) {
                setRevisaoNecessaria(true);
                setRevisaoConfirmada(false);

                setErro(
                    `A comanda ${codigoComanda || comandaId} foi localizada ou aberta, mas o lançamento não pôde ser confirmado. Confira os itens antes de tentar novamente. Detalhe: ${detalhe}`
                );
            } else {
                setErro(detalhe);
            }

            await carregarPainel(true);
        } finally {
            setLancandoConsumo(false);
        }
    }

    async function executarAcao(
        solicitacao: Solicitacao,
        acao: 'confirmar' | 'rejeitar'
    ) {
        const mesa =
            solicitacao.mesa_numero ?? 'identificada pelo QR Code';

        const confirmado =
            acao === 'confirmar'
                ? window.confirm(
                      `Confirmar a solicitação da mesa ${mesa} e lançar os itens na comanda?`
                  )
                : window.confirm(
                      `Deseja realmente rejeitar a solicitação da mesa ${mesa}?`
                  );

        if (!confirmado) return;

        setAcaoEmAndamento(solicitacao.id);
        setErro('');
        setMensagem('');

        try {
            const resposta = await requisicao<Resposta<unknown>>(
                `/solicitacoes-consumo/${encodeURIComponent(solicitacao.id)}/${acao}`,
                { method: 'POST' }
            );

            if (resposta.status === false) {
                throw new Error(
                    resposta.message ||
                        'Não foi possível processar a solicitação.'
                );
            }

            setMensagem(
                resposta.message ||
                    (acao === 'confirmar'
                        ? 'Solicitação confirmada e lançada na comanda.'
                        : 'Solicitação rejeitada.')
            );

            await carregarPainel(true);
        } catch (error) {
            setErro(
                error instanceof Error
                    ? error.message
                    : 'Não foi possível processar a solicitação.'
            );
        } finally {
            setAcaoEmAndamento(null);
        }
    }

    async function carregarDetalheComanda(comandaId: string) {
        setComandaSelecionadaId(comandaId);
        setComandaDetalhe(null);
        setErroDetalhe('');
        setCarregandoDetalhe(true);
        setModalComandaAberto(true);

        try {
            const resposta = await requisicao<Resposta<ComandaDetalhe>>(
                `/comandas/${encodeURIComponent(comandaId)}`
            );

            if (resposta.status === false || !resposta.dados) {
                throw new Error(
                    resposta.message ||
                        'Não foi possível consultar a comanda.'
                );
            }

            setComandaDetalhe(resposta.dados);
        } catch (error) {
            setErroDetalhe(
                error instanceof Error
                    ? error.message
                    : 'Erro ao consultar os dados da comanda.'
            );
        } finally {
            setCarregandoDetalhe(false);
        }
    }

    function mudarAba(novaAba: Aba) {
        setAba(novaAba);
        setErro('');
    }

    const botoesAbas = (
        <div className="flex rounded-xl border border-white/10 bg-[#101310] p-1">
            <button
                type="button"
                onClick={() => mudarAba('mesas')}
                className={`flex min-h-10 flex-1 items-center justify-center gap-2 rounded-lg px-3 text-sm font-semibold transition ${
                    aba === 'mesas'
                        ? 'bg-[#65D69A] text-[#101310]'
                        : 'text-gray-300 hover:bg-white/5'
                }`}
            >
                Mesas
                <span
                    className={`rounded-full px-2 py-0.5 text-xs ${
                        aba === 'mesas' ? 'bg-black/10' : 'bg-white/10'
                    }`}
                >
                    {mesas.length}
                </span>
            </button>

            <button
                type="button"
                onClick={() => mudarAba('solicitacoes')}
                className={`flex min-h-10 flex-1 items-center justify-center gap-2 rounded-lg px-3 text-sm font-semibold transition ${
                    aba === 'solicitacoes'
                        ? 'bg-[#65D69A] text-[#101310]'
                        : 'text-gray-300 hover:bg-white/5'
                }`}
            >
                Solicitações
                {solicitacoes.length > 0 && (
                    <span
                        className={`rounded-full px-2 py-0.5 text-xs ${
                            aba === 'solicitacoes'
                                ? 'bg-black/10'
                                : 'bg-blue-400/20 text-blue-200'
                        }`}
                    >
                        {solicitacoes.length}
                    </span>
                )}
            </button>
        </div>
    );

    function comandaDaMesa(mesaId: string) {
        return comandasAbertas.find(
            (comanda) =>
                comanda.tipo === 'MESA' &&
                String(comanda.mesa_id) === String(mesaId)
        );
    }

    function solicitacoesPendentesDaMesa(mesaId: string) {
        return solicitacoes.filter(
            (solicitacao) =>
                solicitacao.status === 'PENDENTE' &&
                String(solicitacao.mesa_id) === String(mesaId)
        );
    }


    if (carregando) {
        return (
            <main className="flex min-h-screen items-center justify-center bg-[#101310] px-5 text-gray-300">
                Carregando painel do garçom...
            </main>
        );
    }

    return (
        <main className="min-h-screen bg-[#101310] pb-24 text-white sm:pb-8">
            {/* Cabeçalho */}
            <header className="sticky top-0 z-30 border-b border-white/10 bg-[#171B17]/95 backdrop-blur-xl">
                <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-3 py-3 sm:px-5 sm:py-4">
                    <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#65D69A]/10 text-lg font-black text-[#65D69A]">
                            M
                        </div>

                        <div className="min-w-0">
                            <div className="text-lg font-bold leading-5">
                                Menu<span className="text-[#65D69A]">Vivo</span>
                            </div>
                            <p className="mt-1 text-xs text-gray-400">
                                Atendimento
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => void carregarPainel(true)}
                            disabled={atualizando}
                            className={secondaryButtonClass}
                        >
                            <span className="sm:hidden">
                                {atualizando ? '...' : '↻'}
                            </span>
                            <span className="hidden sm:inline">
                                {atualizando ? 'Atualizando...' : 'Atualizar'}
                            </span>
                        </button>

                        <BotaoIcone onClick={sair} label="Sair da conta">
                            <span aria-hidden="true">⇥</span>
                        </BotaoIcone>
                    </div>
                </div>
            </header>

            <div className="mx-auto max-w-7xl px-3 py-5 sm:px-5 sm:py-8">
                <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                        <p className="text-xs font-bold tracking-[0.18em] text-[#65D69A]">
                            PAINEL OPERACIONAL
                        </p>
                        <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
                            Painel do garçom
                        </h1>
                        <p className="mt-1 max-w-xl text-sm text-gray-400">
                            Gerencie as mesas, consulte comandas e registre
                            consumos rapidamente.
                        </p>
                    </div>

                    <button
                        type="button"
                        onClick={() => abrirLancamento()}
                        className="hidden min-h-11 items-center gap-2 rounded-xl bg-[#65D69A] px-4 text-sm font-bold text-[#101310] transition hover:bg-[#7BE5AC] sm:flex"
                    >
                        <span className="text-lg">+</span>
                        Novo consumo
                    </button>
                </div>

                {/* Mensagens */}
                {erro && (
                    <div
                        role="alert"
                        className="mt-5 whitespace-pre-wrap rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300"
                    >
                        {erro}
                    </div>
                )}

                {mensagem && (
                    <div
                        role="status"
                        className="mt-5 flex items-start gap-3 rounded-xl border border-[#65D69A]/30 bg-[#65D69A]/10 px-4 py-3 text-sm text-[#8BE8B4]"
                    >
                        <span className="font-bold">✓</span>
                        <p>{mensagem}</p>
                        <button
                            type="button"
                            onClick={() => setMensagem('')}
                            aria-label="Fechar mensagem"
                            className="ml-auto px-1 text-base"
                        >
                            ×
                        </button>
                    </div>
                )}

                {/* Indicadores */}
                <div className="mt-5 grid grid-cols-2 gap-3 xl:grid-cols-4">
                    <div className="rounded-2xl border border-white/10 bg-[#1A1E1A] p-3 sm:p-4">
                        <p className="text-xs text-gray-400 sm:text-sm">
                            Mesas ativas
                        </p>
                        <p className="mt-2 text-2xl font-bold sm:text-3xl">
                            {mesasAtivas.length}
                        </p>
                        <p className="mt-1 text-[11px] text-gray-500 sm:text-xs">
                            De {mesas.length} cadastradas
                        </p>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-[#1A1E1A] p-3 sm:p-4">
                        <p className="text-xs text-gray-400 sm:text-sm">
                            Comandas abertas
                        </p>
                        <p className="mt-2 text-2xl font-bold sm:text-3xl">
                            {comandasAbertas.length}
                        </p>
                        <p className="mt-1 text-[11px] text-gray-500 sm:text-xs">
                            Mesas e balcão
                        </p>
                    </div>

                    <button
                        type="button"
                        onClick={() => mudarAba('solicitacoes')}
                        className="rounded-2xl border border-blue-400/20 bg-blue-400/[0.06] p-3 text-left transition hover:bg-blue-400/10 sm:p-4"
                    >
                        <p className="text-xs text-gray-400 sm:text-sm">
                            Pendências QR
                        </p>
                        <p className="mt-2 text-2xl font-bold text-blue-300 sm:text-3xl">
                            {solicitacoes.length}
                        </p>
                        <p className="mt-1 text-[11px] text-gray-500 sm:text-xs">
                            Toque para conferir
                        </p>
                    </button>

                    <div className="rounded-2xl border border-[#65D69A]/20 bg-[#65D69A]/[0.04] p-3 sm:p-4">
                        <p className="text-xs text-gray-400 sm:text-sm">
                            Total em aberto
                        </p>
                        <p className="mt-2 break-words text-xl font-bold text-[#65D69A] sm:text-2xl">
                            {formatarMoeda(totalEmComandas)}
                        </p>
                        <p className="mt-1 text-[11px] text-gray-500 sm:text-xs">
                            Todas as comandas abertas
                        </p>
                    </div>
                </div>

                {/* Abas desktop */}
                <div className="mt-7 hidden items-center justify-between gap-4 sm:flex">
                    {botoesAbas}
                    <p className="text-xs text-gray-500">
                        Atualização automática a cada 15 segundos
                    </p>
                </div>

                {/* ABA MESAS */}
                {aba === 'mesas' && (
                    <section className="mt-6">
                        <div className="flex flex-wrap items-end justify-between gap-3">
                            <div>
                                <h2 className="text-xl font-bold sm:text-2xl">
                                    Mesas
                                </h2>
                                <p className="mt-1 text-xs text-gray-400 sm:text-sm">
                                    Consulte a comanda ou lance um novo consumo.
                                </p>
                            </div>

                            <button
                                type="button"
                                onClick={() => abrirLancamento('BALCAO')}
                                className="hidden min-h-10 items-center gap-2 rounded-xl border border-[#65D69A]/30 px-3 text-sm font-semibold text-[#8BE8B4] transition hover:bg-[#65D69A]/10 sm:flex"
                            >
                                + Balcão
                            </button>
                        </div>

                        {/* Busca */}
                        <label className="relative mt-4 block">
                            <span className="sr-only">
                                Buscar mesa por número
                            </span>
                            <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-gray-500">
                                ⌕
                            </span>
                            <input
                                value={pesquisaMesa}
                                onChange={(event) =>
                                    setPesquisaMesa(event.target.value)
                                }
                                inputMode="numeric"
                                placeholder="Buscar número da mesa..."
                                className="min-h-12 w-full rounded-xl border border-white/10 bg-[#1A1E1A] py-3 pl-10 pr-4 text-sm outline-none transition placeholder:text-gray-500 focus:border-[#65D69A]/60"
                            />
                        </label>

                        {/* Filtros */}
                        <div className="-mx-3 mt-3 flex gap-2 overflow-x-auto px-3 pb-1 sm:mx-0 sm:px-0">
                            {(
                                [
                                    ['TODAS', 'Todas'],
                                    ['LIVRES', 'Livres'],
                                    ['ATENDIMENTO', 'Em atendimento'],
                                    ['INATIVAS', 'Inativas'],
                                ] as [FiltroMesa, string][]
                            ).map(([valor, rotulo]) => (
                                <button
                                    key={valor}
                                    type="button"
                                    onClick={() => setFiltroMesa(valor)}
                                    className={`min-h-10 shrink-0 rounded-full border px-4 text-xs font-semibold transition ${
                                        filtroMesa === valor
                                            ? 'border-[#65D69A] bg-[#65D69A]/10 text-[#8BE8B4]'
                                            : 'border-white/10 bg-[#1A1E1A] text-gray-400 hover:bg-white/5'
                                    }`}
                                >
                                    {rotulo}
                                </button>
                            ))}
                        </div>

                        <p className="mt-3 text-xs text-gray-500">
                            {mesasVisiveis.length}{' '}
                            {mesasVisiveis.length === 1
                                ? 'mesa encontrada'
                                : 'mesas encontradas'}
                        </p>

                        {mesasVisiveis.length === 0 ? (
                            <div className="mt-4 rounded-2xl border border-white/10 bg-[#1A1E1A] px-5 py-12 text-center">
                                <div className="text-3xl">⌕</div>
                                <h3 className="mt-3 font-semibold">
                                    Nenhuma mesa encontrada
                                </h3>
                                <p className="mt-1 text-sm text-gray-400">
                                    Altere a busca ou selecione outro filtro.
                                </p>
                            </div>
                        ) : (
                            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-5">
                                {mesasVisiveis.map((mesa) => {
                                    const comanda = comandaDaMesa(mesa.id);
                                    const ativa = mesa.status === 'ATIVA';

                                    const pendenciasMesa = solicitacoesPendentesDaMesa(mesa.id);
                                    const quantidadePendencias = pendenciasMesa.length;
                                    const temSolicitacaoPendente = quantidadePendencias > 0;

                                    return (
                                        <article
                                            key={mesa.id}
                                            className={`flex min-h-[200px] flex-col rounded-2xl border p-3 transition sm:min-h-[225px] sm:p-4 ${
                                                temSolicitacaoPendente
                                                    ? 'border-red-400/70 bg-red-500/[0.07] shadow-lg shadow-red-950/20'
                                                    : 'border-white/10 bg-[#1A1E1A] hover:border-white/20'
                                            }`}
                                        >
                                            {/* Cabeçalho do card */}
                                            <div className="flex items-start justify-between gap-2">
                                                <div className="min-w-0">
                                                    <p className="text-[10px] font-semibold tracking-wider text-gray-500 sm:text-xs">
                                                        MESA
                                                    </p>

                                                    <h3 className="mt-1 text-3xl font-bold tracking-tight sm:text-4xl">
                                                        {mesa.numero}
                                                    </h3>
                                                </div>

                                                <div className="flex shrink-0 items-center gap-2">
                                                    {temSolicitacaoPendente && (
                                                        <button
                                                            type="button"
                                                            onClick={() => mudarAba('solicitacoes')}
                                                            aria-label={`Ver ${quantidadePendencias} solicitação(ões) pendente(s) da mesa ${mesa.numero}`}
                                                            title={`${quantidadePendencias} solicitação(ões) aguardando confirmação`}
                                                            className="relative flex h-11 w-11 items-center justify-center rounded-xl border border-red-400/40 bg-red-500/15 text-red-300 transition hover:bg-red-500/25 focus:outline-none focus:ring-2 focus:ring-red-400"
                                                        >
                                                            <svg
                                                                aria-hidden="true"
                                                                xmlns="http://www.w3.org/2000/svg"
                                                                width="23"
                                                                height="23"
                                                                viewBox="0 0 24 24"
                                                                fill="none"
                                                                stroke="currentColor"
                                                                strokeWidth="2"
                                                                strokeLinecap="round"
                                                                strokeLinejoin="round"
                                                            >
                                                                <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
                                                                <path d="M10 21h4" />
                                                            </svg>

                                                            <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-extrabold text-white ring-2 ring-[#1A1E1A]">
                                                                {quantidadePendencias > 99
                                                                    ? '99+'
                                                                    : quantidadePendencias}
                                                            </span>
                                                        </button>
                                                    )}

                                                    <span
                                                        className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${
                                                            !ativa
                                                                ? 'bg-gray-500'
                                                                : comanda
                                                                ? 'bg-amber-400'
                                                                : 'bg-[#65D69A]'
                                                        }`}
                                                        title={
                                                            !ativa
                                                                ? 'Inativa'
                                                                : comanda
                                                                ? 'Em atendimento'
                                                                : 'Livre'
                                                        }
                                                    />
                                                </div>
                                            </div>

                                            {/* Situação da mesa */}
                                            <div className="mt-3 min-h-10">
                                                <p
                                                    className={`text-xs font-semibold ${
                                                        !ativa
                                                            ? 'text-gray-500'
                                                            : comanda
                                                            ? 'text-amber-300'
                                                            : 'text-[#8BE8B4]'
                                                    }`}
                                                >
                                                    {!ativa
                                                        ? 'Inativa'
                                                        : comanda
                                                        ? 'Em atendimento'
                                                        : 'Livre'}
                                                </p>

                                                {comanda ? (
                                                    <>
                                                        <p className="mt-1 truncate text-[10px] text-gray-500 sm:text-xs">
                                                            {comanda.codigo}
                                                        </p>

                                                        <p className="mt-0.5 truncate text-xs font-semibold text-gray-200 sm:text-sm">
                                                            {formatarMoeda(comanda.total)}
                                                        </p>
                                                    </>
                                                ) : (
                                                    <p className="mt-1 text-[10px] text-gray-500 sm:text-xs">
                                                        {ativa
                                                            ? 'Pronta para atender'
                                                            : 'Indisponível'}
                                                    </p>
                                                )}
                                            </div>

                                            {/* Alerta de solicitações do QR Code */}
                                            {temSolicitacaoPendente && (
                                                <button
                                                    type="button"
                                                    onClick={() => mudarAba('solicitacoes')}
                                                    className="mt-3 flex w-full items-center gap-2 rounded-xl border border-red-400/30 bg-red-500/10 p-2.5 text-left transition hover:bg-red-500/20 focus:outline-none focus:ring-2 focus:ring-red-400"
                                                >
                                                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-red-500/15 text-red-300">
                                                        <svg
                                                            aria-hidden="true"
                                                            xmlns="http://www.w3.org/2000/svg"
                                                            width="18"
                                                            height="18"
                                                            viewBox="0 0 24 24"
                                                            fill="none"
                                                            stroke="currentColor"
                                                            strokeWidth="2"
                                                            strokeLinecap="round"
                                                            strokeLinejoin="round"
                                                        >
                                                            <path d="M12 9v4" />
                                                            <path d="M12 17h.01" />
                                                            <path d="M10.3 3.9 1.8 18.6a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
                                                        </svg>
                                                    </span>

                                                    <span className="min-w-0 flex-1">
                                                        <span className="block text-xs font-bold text-red-300">
                                                            {quantidadePendencias === 1
                                                                ? 'Novo pedido do QR Code'
                                                                : `${quantidadePendencias} solicitações pendentes`}
                                                        </span>

                                                        <span className="mt-0.5 block text-[10px] text-red-200/70">
                                                            Toque para conferir
                                                        </span>
                                                    </span>

                                                    <span
                                                        aria-hidden="true"
                                                        className="text-lg font-bold text-red-300"
                                                    >
                                                        ›
                                                    </span>
                                                </button>
                                            )}

                                            {/* Ações da mesa */}
                                            <div className="mt-auto space-y-2 pt-3">
                                                {comanda && (
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            void carregarDetalheComanda(comanda.id)
                                                        }
                                                        className="min-h-10 w-full rounded-xl border border-white/10 px-2 py-2 text-xs font-semibold text-gray-200 transition hover:border-[#65D69A]/40 hover:bg-white/5 sm:text-sm"
                                                    >
                                                        Ver comanda
                                                    </button>
                                                )}

                                                <button
                                                    type="button"
                                                    disabled={!ativa}
                                                    onClick={() => abrirLancamento('MESA', mesa.id)}
                                                    className="min-h-10 w-full rounded-xl bg-[#65D69A] px-2 py-2 text-xs font-bold text-[#101310] transition hover:bg-[#7BE5AC] disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-gray-500 sm:text-sm"
                                                >
                                                    {comanda ? 'Adicionar itens' : 'Lançar consumo'}
                                                </button>
                                            </div>
                                        </article>
                                    );
                                })}
                            </div>
                        )}

                        {/* Comandas de balcão */}
                        {comandasAbertas.some(
                            (comanda) => comanda.tipo === 'BALCAO'
                        ) && (
                            <section className="mt-8">
                                <h2 className="text-lg font-bold">
                                    Comandas de balcão abertas
                                </h2>

                                <p className="mt-1 text-sm text-gray-400">
                                    Consulte os itens e valores dos atendimentos
                                    sem mesa.
                                </p>

                                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                    {comandasAbertas
                                        .filter(
                                            (comanda) =>
                                                comanda.tipo === 'BALCAO'
                                        )
                                        .map((comanda) => (
                                            <article
                                                key={comanda.id}
                                                className="rounded-xl border border-white/10 bg-[#1A1E1A] p-4"
                                            >
                                                <div className="flex items-start justify-between gap-3">
                                                    <div className="min-w-0">
                                                        <p className="text-xs text-gray-400">
                                                            COMANDA
                                                        </p>
                                                        <h3 className="mt-1 break-all font-bold">
                                                            {comanda.codigo}
                                                        </h3>
                                                        <p className="mt-1 truncate text-sm text-gray-400">
                                                            {comanda.cliente_nome ||
                                                                'Cliente não identificado'}
                                                        </p>
                                                    </div>

                                                    <p className="shrink-0 font-bold text-[#65D69A]">
                                                        {formatarMoeda(
                                                            comanda.total
                                                        )}
                                                    </p>
                                                </div>

                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        void carregarDetalheComanda(
                                                            comanda.id
                                                        )
                                                    }
                                                    className="mt-4 min-h-11 w-full rounded-xl border border-white/10 text-sm font-semibold transition hover:border-[#65D69A]/40 hover:bg-white/5"
                                                >
                                                    Ver comanda completa
                                                </button>
                                            </article>
                                        ))}
                                </div>
                            </section>
                        )}

                        <button
                            type="button"
                            onClick={() => abrirLancamento('BALCAO')}
                            className="mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-[#65D69A]/30 bg-[#65D69A]/[0.04] px-4 text-sm font-semibold text-[#8BE8B4] transition hover:bg-[#65D69A]/10 sm:hidden"
                        >
                            <span className="text-lg">+</span>
                            Lançar consumo no balcão
                        </button>
                    </section>
                )}

                {/* ABA SOLICITAÇÕES */}
                {aba === 'solicitacoes' && (
                    <section className="mt-6">
                        <div className="flex flex-wrap items-end justify-between gap-3">
                            <div>
                                <h2 className="text-xl font-bold sm:text-2xl">
                                    Solicitações pendentes
                                </h2>
                                <p className="mt-1 text-xs text-gray-400 sm:text-sm">
                                    Solicitações enviadas pelos clientes através
                                    do QR Code.
                                </p>
                            </div>

                            <span className="rounded-full border border-blue-400/20 bg-blue-400/10 px-3 py-1.5 text-xs font-semibold text-blue-300">
                                {solicitacoes.length} pendente(s)
                            </span>
                        </div>

                        {solicitacoes.length === 0 ? (
                            <div className="mt-5 rounded-2xl border border-white/10 bg-[#1A1E1A] px-5 py-12 text-center">
                                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#65D69A]/10 text-2xl text-[#65D69A]">
                                    ✓
                                </div>
                                <h3 className="mt-4 font-semibold">
                                    Tudo em dia!
                                </h3>
                                <p className="mx-auto mt-2 max-w-sm text-sm text-gray-400">
                                    Não há solicitações aguardando confirmação.
                                    As novas aparecerão aqui automaticamente.
                                </p>
                                <button
                                    type="button"
                                    onClick={() => void carregarPainel(true)}
                                    className={`mt-5 ${secondaryButtonClass}`}
                                >
                                    Verificar agora
                                </button>
                            </div>
                        ) : (
                            <div className="mt-4 grid gap-4 xl:grid-cols-2">
                                {solicitacoes.map((solicitacao) => {
                                    const total = (
                                        solicitacao.itens ?? []
                                    ).reduce(
                                        (soma, item) =>
                                            soma +
                                            Number(item.subtotal || 0),
                                        0
                                    );

                                    const ocupado =
                                        acaoEmAndamento === solicitacao.id;

                                    return (
                                        <article
                                            key={solicitacao.id}
                                            className="overflow-hidden rounded-2xl border border-white/10 bg-[#1A1E1A]"
                                        >
                                            <div className="flex items-start justify-between gap-3 border-b border-white/10 p-4 sm:p-5">
                                                <div className="min-w-0">
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <h3 className="text-xl font-bold">
                                                            Mesa{' '}
                                                            {solicitacao.mesa_numero ??
                                                                '—'}
                                                        </h3>
                                                        <span className="rounded-full bg-blue-400/10 px-2.5 py-1 text-[10px] font-semibold text-blue-300">
                                                            Pendente
                                                        </span>
                                                    </div>

                                                    <p className="mt-2 truncate text-sm text-gray-300">
                                                        {solicitacao.cliente_nome ||
                                                            'Cliente não identificado'}
                                                    </p>
                                                    <p className="mt-1 text-xs text-gray-500">
                                                        {formatarData(
                                                            solicitacao.created_at
                                                        )}
                                                    </p>
                                                </div>

                                                <div className="shrink-0 text-right">
                                                    <p className="text-[10px] text-gray-500">
                                                        TOTAL
                                                    </p>
                                                    <p className="mt-1 text-lg font-bold text-[#65D69A]">
                                                        {formatarMoeda(total)}
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="p-4 sm:p-5">
                                                <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                                                    Itens solicitados
                                                </p>

                                                {!solicitacao.itens?.length ? (
                                                    <p className="mt-3 text-sm text-gray-500">
                                                        A API não retornou os
                                                        itens desta solicitação.
                                                    </p>
                                                ) : (
                                                    <div className="mt-3 space-y-3">
                                                        {solicitacao.itens.map(
                                                            (item) => (
                                                                <div
                                                                    key={item.id}
                                                                    className="flex items-start justify-between gap-3"
                                                                >
                                                                    <div className="min-w-0">
                                                                        <p className="text-sm font-medium">
                                                                            <span className="text-[#8BE8B4]">
                                                                                {
                                                                                    item.quantidade
                                                                                }{' '}
                                                                                ×
                                                                            </span>{' '}
                                                                            {
                                                                                item.produto_nome
                                                                            }
                                                                        </p>

                                                                        {item.observacao && (
                                                                            <p className="mt-1 whitespace-pre-wrap text-xs text-amber-300">
                                                                                Obs.:{' '}
                                                                                {
                                                                                    item.observacao
                                                                                }
                                                                            </p>
                                                                        )}

                                                                        <p className="mt-1 text-[11px] text-gray-500">
                                                                            Unitário:{' '}
                                                                            {formatarMoeda(
                                                                                item.preco_unitario
                                                                            )}
                                                                        </p>
                                                                    </div>

                                                                    <p className="shrink-0 text-sm font-semibold">
                                                                        {formatarMoeda(
                                                                            item.subtotal
                                                                        )}
                                                                    </p>
                                                                </div>
                                                            )
                                                        )}
                                                    </div>
                                                )}

                                                {solicitacao.observacao && (
                                                    <div className="mt-4 rounded-xl border border-amber-400/20 bg-amber-400/[0.04] p-3">
                                                        <p className="text-xs font-semibold text-amber-300">
                                                            Observação do cliente
                                                        </p>
                                                        <p className="mt-1 whitespace-pre-wrap text-sm text-gray-300">
                                                            {
                                                                solicitacao.observacao
                                                            }
                                                        </p>
                                                    </div>
                                                )}

                                                <div className="mt-5 grid grid-cols-2 gap-2">
                                                    <button
                                                        type="button"
                                                        disabled={ocupado}
                                                        onClick={() =>
                                                            void executarAcao(
                                                                solicitacao,
                                                                'rejeitar'
                                                            )
                                                        }
                                                        className="min-h-11 rounded-xl border border-red-500/30 px-3 text-sm font-semibold text-red-300 transition hover:bg-red-500/10 disabled:opacity-40"
                                                    >
                                                        {ocupado
                                                            ? 'Processando...'
                                                            : 'Rejeitar'}
                                                    </button>

                                                    <button
                                                        type="button"
                                                        disabled={ocupado}
                                                        onClick={() =>
                                                            void executarAcao(
                                                                solicitacao,
                                                                'confirmar'
                                                            )
                                                        }
                                                        className="min-h-11 rounded-xl bg-[#65D69A] px-3 text-sm font-bold text-[#101310] transition hover:bg-[#7BE5AC] disabled:opacity-40"
                                                    >
                                                        {ocupado
                                                            ? 'Processando...'
                                                            : 'Confirmar'}
                                                    </button>
                                                </div>
                                            </div>
                                        </article>
                                    );
                                })}
                            </div>
                        )}
                    </section>
                )}
            </div>

            {/* Navegação inferior no celular */}
            <nav
                aria-label="Navegação do garçom"
                className="fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-[#171B17]/95 px-2 pb-[env(safe-area-inset-bottom)] pt-2 backdrop-blur-xl sm:hidden"
            >
                <div className="mx-auto grid max-w-lg grid-cols-3 gap-1">
                    <button
                        type="button"
                        onClick={() => mudarAba('mesas')}
                        className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl text-xs transition ${
                            aba === 'mesas'
                                ? 'text-[#8BE8B4]'
                                : 'text-gray-400'
                        }`}
                    >
                        <span className="text-xl leading-5">▦</span>
                        <span className="font-semibold">Mesas</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => mudarAba('solicitacoes')}
                        className={`relative flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl text-xs transition ${
                            aba === 'solicitacoes'
                                ? 'text-[#8BE8B4]'
                                : 'text-gray-400'
                        }`}
                    >
                        <span className="text-xl leading-5">☷</span>
                        <span className="font-semibold">Solicitações</span>

                        {solicitacoes.length > 0 && (
                            <span className="absolute right-2 top-0 flex h-5 min-w-5 items-center justify-center rounded-full bg-blue-400 px-1 text-[10px] font-bold text-[#101310]">
                                {solicitacoes.length > 99
                                    ? '99+'
                                    : solicitacoes.length}
                            </span>
                        )}
                    </button>

                    <button
                        type="button"
                        onClick={() => abrirLancamento()}
                        className="flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl text-xs text-[#8BE8B4] transition"
                    >
                        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#65D69A] text-xl font-bold leading-none text-[#101310]">
                            +
                        </span>
                        <span className="font-semibold">Lançar</span>
                    </button>
                </div>
            </nav>

            {/* MODAL DE LANÇAMENTO MANUAL */}
            {modalAberto && (
                <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 sm:items-center sm:p-4">
                    <section
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="titulo-modal-consumo"
                        className="flex max-h-[94dvh] w-full max-w-3xl flex-col overflow-hidden rounded-t-3xl border border-white/10 bg-[#171B17] shadow-2xl sm:max-h-[90dvh] sm:rounded-2xl"
                    >
                        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 px-4 py-4 sm:px-6">
                            <div className="min-w-0">
                                <p className="text-[10px] font-bold tracking-[0.18em] text-[#65D69A]">
                                    NOVO LANÇAMENTO
                                </p>
                                <h2
                                    id="titulo-modal-consumo"
                                    className="mt-1 truncate text-xl font-bold"
                                >
                                    Registrar consumo
                                </h2>
                                <p className="mt-1 text-xs text-gray-400">
                                    Selecione o atendimento e os produtos.
                                </p>
                            </div>

                            <BotaoIcone
                                onClick={fecharModalLancamento}
                                label="Fechar lançamento"
                                disabled={lancandoConsumo}
                            >
                                <span className="text-2xl leading-none">×</span>
                            </BotaoIcone>
                        </div>

                        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6 sm:py-5">
                            {erro && (
                                <div
                                    role="alert"
                                    className="mb-4 whitespace-pre-wrap rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300"
                                >
                                    {erro}
                                </div>
                            )}

                            <form
                                id="formulario-consumo"
                                onSubmit={lancarConsumo}
                                className="space-y-5"
                            >
                                <div>
                                    <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-gray-400">
                                        Tipo de atendimento
                                    </label>

                                    <div className="grid grid-cols-2 gap-2">
                                        <button
                                            type="button"
                                            onClick={() =>
                                                mudarTipoAtendimento('MESA')
                                            }
                                            className={`min-h-12 rounded-xl border px-3 text-sm font-semibold transition ${
                                                tipoAtendimento === 'MESA'
                                                    ? 'border-[#65D69A] bg-[#65D69A]/10 text-[#8BE8B4]'
                                                    : 'border-white/10 text-gray-300 hover:bg-white/5'
                                            }`}
                                        >
                                            Mesa
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() =>
                                                mudarTipoAtendimento('BALCAO')
                                            }
                                            className={`min-h-12 rounded-xl border px-3 text-sm font-semibold transition ${
                                                tipoAtendimento === 'BALCAO'
                                                    ? 'border-[#65D69A] bg-[#65D69A]/10 text-[#8BE8B4]'
                                                    : 'border-white/10 text-gray-300 hover:bg-white/5'
                                            }`}
                                        >
                                            Balcão
                                        </button>
                                    </div>
                                </div>

                                <div className="grid gap-4 sm:grid-cols-2">
                                    {tipoAtendimento === 'MESA' ? (
                                        <div>
                                            <label
                                                htmlFor="mesa-consumo"
                                                className="mb-2 block text-sm font-medium"
                                            >
                                                Mesa
                                            </label>

                                            <select
                                                id="mesa-consumo"
                                                required
                                                value={mesaSelecionadaId}
                                                onChange={(event) =>
                                                    setMesaSelecionadaId(
                                                        event.target.value
                                                    )
                                                }
                                                className={inputClass}
                                            >
                                                <option value="">
                                                    Selecione uma mesa
                                                </option>

                                                {mesas.map((mesa) => (
                                                    <option
                                                        key={mesa.id}
                                                        value={mesa.id}
                                                        disabled={
                                                            mesa.status !==
                                                            'ATIVA'
                                                        }
                                                    >
                                                        Mesa {mesa.numero}
                                                        {mesa.status !==
                                                        'ATIVA'
                                                            ? ' (inativa)'
                                                            : comandaDaMesa(
                                                                    mesa.id
                                                                )
                                                              ? ' (comanda aberta)'
                                                              : ' (livre)'}
                                                    </option>
                                                ))}
                                            </select>

                                            {mesaSelecionadaId &&
                                                comandaDaMesa(
                                                    mesaSelecionadaId
                                                ) && (
                                                    <p className="mt-2 text-xs text-[#8BE8B4]">
                                                        Será reutilizada a
                                                        comanda{' '}
                                                        {
                                                            comandaDaMesa(
                                                                mesaSelecionadaId
                                                            )?.codigo
                                                        }
                                                        .
                                                    </p>
                                                )}
                                        </div>
                                    ) : (
                                        <div>
                                            <label
                                                htmlFor="comanda-balcao"
                                                className="mb-2 block text-sm font-medium"
                                            >
                                                Comanda de balcão
                                            </label>

                                            <select
                                                id="comanda-balcao"
                                                value={comandaBalcaoId}
                                                onChange={(event) =>
                                                    setComandaBalcaoId(
                                                        event.target.value
                                                    )
                                                }
                                                className={inputClass}
                                            >
                                                <option value="">
                                                    Abrir nova comanda
                                                </option>

                                                {comandasAbertas
                                                    .filter(
                                                        (comanda) =>
                                                            comanda.tipo ===
                                                            'BALCAO'
                                                    )
                                                    .map((comanda) => (
                                                        <option
                                                            key={comanda.id}
                                                            value={comanda.id}
                                                        >
                                                            {comanda.codigo}
                                                            {' · '}
                                                            {formatarMoeda(
                                                                comanda.total
                                                            )}
                                                        </option>
                                                    ))}
                                            </select>
                                        </div>
                                    )}

                                    <div>
                                        <label
                                            htmlFor="cliente-nome"
                                            className="mb-2 block text-sm font-medium"
                                        >
                                            Cliente (opcional)
                                        </label>

                                        <input
                                            id="cliente-nome"
                                            value={clienteNome}
                                            onChange={(event) =>
                                                setClienteNome(
                                                    event.target.value
                                                )
                                            }
                                            maxLength={150}
                                            placeholder="Nome do cliente"
                                            className={inputClass}
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label
                                        htmlFor="observacao-abertura"
                                        className="mb-2 block text-sm font-medium"
                                    >
                                        Observação geral (opcional)
                                    </label>

                                    <input
                                        id="observacao-abertura"
                                        value={observacaoAbertura}
                                        onChange={(event) =>
                                            setObservacaoAbertura(
                                                event.target.value
                                            )
                                        }
                                        maxLength={1000}
                                        placeholder="Observação para a comanda"
                                        className={inputClass}
                                    />
                                </div>

                                <div className="rounded-2xl border border-white/10 bg-[#101310]/60 p-3 sm:p-4">
                                    <h3 className="text-sm font-bold">
                                        Adicionar produto
                                    </h3>

                                    <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_100px]">
                                        <div>
                                            <label
                                                htmlFor="produto-consumo"
                                                className="mb-1.5 block text-xs text-gray-400"
                                            >
                                                Produto
                                            </label>

                                            <select
                                                id="produto-consumo"
                                                value={produtoSelecionadoId}
                                                onChange={(event) =>
                                                    setProdutoSelecionadoId(
                                                        event.target.value
                                                    )
                                                }
                                                className={inputClass}
                                            >
                                                <option value="">
                                                    Escolha um produto
                                                </option>

                                                {produtos.map((produto) => (
                                                    <option
                                                        key={produto.id}
                                                        value={produto.id}
                                                    >
                                                        {produto.nome}
                                                        {' — '}
                                                        {formatarMoeda(
                                                            produto.preco
                                                        )}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>

                                        <div>
                                            <label
                                                htmlFor="quantidade-consumo"
                                                className="mb-1.5 block text-xs text-gray-400"
                                            >
                                                Quantidade
                                            </label>

                                            <input
                                                id="quantidade-consumo"
                                                type="number"
                                                min={1}
                                                max={999}
                                                step={1}
                                                value={quantidadeAdicionar}
                                                onChange={(event) =>
                                                    setQuantidadeAdicionar(
                                                        Number(
                                                            event.target.value
                                                        )
                                                    )
                                                }
                                                className={inputClass}
                                            />
                                        </div>
                                    </div>

                                    <div className="mt-3">
                                        <label
                                            htmlFor="observacao-item"
                                            className="mb-1.5 block text-xs text-gray-400"
                                        >
                                            Observação do item (opcional)
                                        </label>

                                        <input
                                            id="observacao-item"
                                            value={observacaoItem}
                                            onChange={(event) =>
                                                setObservacaoItem(
                                                    event.target.value
                                                )
                                            }
                                            maxLength={500}
                                            placeholder="Ex.: sem gelo, sem cebola..."
                                            className={inputClass}
                                        />
                                    </div>

                                    <button
                                        type="button"
                                        onClick={adicionarProdutoAoCarrinho}
                                        className="mt-3 min-h-12 w-full rounded-xl border border-[#65D69A]/30 bg-[#65D69A]/[0.06] px-4 text-sm font-bold text-[#8BE8B4] transition hover:bg-[#65D69A]/10"
                                    >
                                        + Adicionar ao consumo
                                    </button>
                                </div>

                                <div>
                                    <div className="flex items-center justify-between gap-3">
                                        <h3 className="text-sm font-bold">
                                            Itens do consumo
                                        </h3>

                                        <span className="rounded-full bg-white/5 px-2.5 py-1 text-xs text-gray-400">
                                            {carrinho.length} item(ns)
                                        </span>
                                    </div>

                                    {carrinho.length === 0 ? (
                                        <div className="mt-3 rounded-xl border border-dashed border-white/15 px-4 py-7 text-center">
                                            <p className="text-sm text-gray-400">
                                                Nenhum produto adicionado.
                                            </p>
                                            <p className="mt-1 text-xs text-gray-500">
                                                Os itens escolhidos aparecerão
                                                aqui.
                                            </p>
                                        </div>
                                    ) : (
                                        <div className="mt-3 space-y-2">
                                            {carrinho.map((item) => (
                                                <div
                                                    key={item.chave}
                                                    className="rounded-xl border border-white/10 bg-white/[0.02] p-3"
                                                >
                                                    <div className="flex items-start justify-between gap-3">
                                                        <div className="min-w-0 flex-1">
                                                            <p className="break-words text-sm font-semibold">
                                                                {item.produto_nome}
                                                            </p>
                                                            <p className="mt-1 text-xs text-gray-400">
                                                                {formatarMoeda(
                                                                    item.preco
                                                                )}{' '}
                                                                cada
                                                            </p>
                                                        </div>

                                                        <button
                                                            type="button"
                                                            onClick={() =>
                                                                removerItemCarrinho(
                                                                    item.chave
                                                                )
                                                            }
                                                            aria-label={`Remover ${item.produto_nome}`}
                                                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-lg text-red-300 transition hover:bg-red-500/10"
                                                        >
                                                            ×
                                                        </button>
                                                    </div>

                                                    <div className="mt-3 flex items-center justify-between gap-3">
                                                        <div className="flex items-center rounded-lg border border-white/10 bg-[#101310]">
                                                            <button
                                                                type="button"
                                                                aria-label="Diminuir quantidade"
                                                                disabled={
                                                                    item.quantidade <=
                                                                    1
                                                                }
                                                                onClick={() =>
                                                                    alterarQuantidadeItem(
                                                                        item.chave,
                                                                        item.quantidade -
                                                                            1
                                                                    )
                                                                }
                                                                className="h-10 w-10 text-lg disabled:opacity-30"
                                                            >
                                                                −
                                                            </button>

                                                            <span className="min-w-8 text-center text-sm font-semibold">
                                                                {item.quantidade}
                                                            </span>

                                                            <button
                                                                type="button"
                                                                aria-label="Aumentar quantidade"
                                                                disabled={
                                                                    item.quantidade >=
                                                                    999
                                                                }
                                                                onClick={() =>
                                                                    alterarQuantidadeItem(
                                                                        item.chave,
                                                                        item.quantidade +
                                                                            1
                                                                    )
                                                                }
                                                                className="h-10 w-10 text-lg disabled:opacity-30"
                                                            >
                                                                +
                                                            </button>
                                                        </div>

                                                        <p className="text-sm font-bold text-[#8BE8B4]">
                                                            {formatarMoeda(
                                                                item.preco *
                                                                    item.quantidade
                                                            )}
                                                        </p>
                                                    </div>

                                                    <label className="mt-3 block">
                                                        <span className="mb-1 block text-[11px] text-gray-500">
                                                            Observação do item
                                                        </span>
                                                        <input
                                                            value={item.observacao}
                                                            maxLength={500}
                                                            onChange={(event) =>
                                                                alterarObservacaoItem(
                                                                    item.chave,
                                                                    event.target
                                                                        .value
                                                                )
                                                            }
                                                            placeholder="Opcional"
                                                            className="min-h-10 w-full rounded-lg border border-white/10 bg-[#101310] px-3 text-xs outline-none focus:border-[#65D69A]"
                                                        />
                                                    </label>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {revisaoNecessaria && (
                                    <div className="rounded-xl border border-amber-400/30 bg-amber-400/[0.05] p-3">
                                        <p className="text-sm font-semibold text-amber-300">
                                            Confira a comanda antes de reenviar
                                        </p>
                                        <p className="mt-1 text-xs leading-5 text-gray-300">
                                            Uma tentativa anterior falhou
                                            parcialmente. Verifique se o último
                                            item foi salvo antes de tentar
                                            novamente.
                                        </p>

                                        <label className="mt-3 flex items-start gap-3 text-xs leading-5 text-gray-300">
                                            <input
                                                type="checkbox"
                                                checked={revisaoConfirmada}
                                                onChange={(event) =>
                                                    setRevisaoConfirmada(
                                                        event.target.checked
                                                    )
                                                }
                                                className="mt-1 accent-[#65D69A]"
                                            />
                                            Conferi a comanda e confirmei que
                                            os itens restantes não estão
                                            duplicados.
                                        </label>
                                    </div>
                                )}
                            </form>
                        </div>

                        {/* Rodapé persistente */}
                        <div className="shrink-0 border-t border-white/10 bg-[#171B17] px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 sm:px-6 sm:pb-4">
                            <div className="flex items-center justify-between gap-4">
                                <div className="min-w-0">
                                    <p className="text-xs text-gray-400">
                                        Total estimado
                                    </p>
                                    <p className="mt-0.5 text-2xl font-bold text-[#65D69A]">
                                        {formatarMoeda(totalCarrinho)}
                                    </p>
                                </div>

                                <button
                                    type="submit"
                                    form="formulario-consumo"
                                    disabled={
                                        lancandoConsumo ||
                                        carrinho.length === 0 ||
                                        (revisaoNecessaria &&
                                            !revisaoConfirmada)
                                    }
                                    className="min-h-12 flex-1 rounded-xl bg-[#65D69A] px-4 text-sm font-bold text-[#101310] transition hover:bg-[#7BE5AC] disabled:cursor-not-allowed disabled:opacity-40 sm:max-w-xs"
                                >
                                    {lancandoConsumo
                                        ? 'Lançando...'
                                        : 'Confirmar consumo'}
                                </button>
                            </div>

                            <p className="mt-2 text-center text-[10px] text-gray-500">
                                Os preços e a disponibilidade são validados
                                novamente pela API.
                            </p>
                        </div>
                    </section>
                </div>
            )}

            {/* MODAL DE CONSULTA COMPLETA DA COMANDA */}
            {modalComandaAberto && (
                <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/75 sm:items-center sm:p-4">
                    <section
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="titulo-detalhe-comanda"
                        className="flex max-h-[94dvh] w-full max-w-3xl flex-col overflow-hidden rounded-t-3xl border border-white/10 bg-[#171B17] shadow-2xl sm:max-h-[90dvh] sm:rounded-2xl"
                    >
                        {/* Cabeçalho do detalhe */}
                        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 px-4 py-4 sm:px-6">
                            <div className="min-w-0">
                                <p className="text-[10px] font-bold tracking-[0.18em] text-[#65D69A]">
                                    CONSULTA DE COMANDA
                                </p>

                                <h2
                                    id="titulo-detalhe-comanda"
                                    className="mt-1 break-words text-xl font-bold"
                                >
                                    {comandaDetalhe?.codigo ||
                                        'Detalhes da comanda'}
                                </h2>

                                <p className="mt-1 text-xs text-gray-400">
                                    Dados, itens, valores e pagamentos
                                </p>
                            </div>

                            <BotaoIcone
                                onClick={() => setModalComandaAberto(false)}
                                label="Fechar consulta"
                            >
                                <span className="text-2xl leading-none">×</span>
                            </BotaoIcone>
                        </div>

                        {/* Conteúdo rolável */}
                        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6 sm:py-5">
                            {carregandoDetalhe && (
                                <div className="py-16 text-center text-sm text-gray-400">
                                    Carregando dados da comanda...
                                </div>
                            )}

                            {!carregandoDetalhe && erroDetalhe && (
                                <div
                                    role="alert"
                                    className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300"
                                >
                                    <p>{erroDetalhe}</p>

                                    <button
                                        type="button"
                                        onClick={() =>
                                            void carregarDetalheComanda(
                                                comandaSelecionadaId
                                            )
                                        }
                                        disabled={!comandaSelecionadaId}
                                        className="mt-3 min-h-10 rounded-lg border border-red-500/30 px-3 font-semibold disabled:opacity-40"
                                    >
                                        Tentar novamente
                                    </button>
                                </div>
                            )}

                            {!carregandoDetalhe &&
                                !erroDetalhe &&
                                comandaDetalhe && (
                                    <div className="space-y-5">
                                        {/* Identificação da comanda */}
                                        <section className="rounded-2xl border border-white/10 bg-white/[0.025] p-4">
                                            <div className="flex flex-wrap items-center justify-between gap-3">
                                                <div className="min-w-0">
                                                    <p className="text-xs text-gray-400">
                                                        Código da comanda
                                                    </p>

                                                    <h3 className="mt-1 break-all text-lg font-bold">
                                                        {comandaDetalhe.codigo}
                                                    </h3>
                                                </div>

                                                <span
                                                    className={`rounded-full px-3 py-1.5 text-xs font-bold ${
                                                        comandaDetalhe.status ===
                                                        'ABERTA'
                                                            ? 'bg-[#65D69A]/10 text-[#8BE8B4]'
                                                            : 'bg-gray-500/10 text-gray-300'
                                                    }`}
                                                >
                                                    {comandaDetalhe.status}
                                                </span>
                                            </div>

                                            <div className="mt-4 grid grid-cols-2 gap-4">
                                                <div>
                                                    <p className="text-xs text-gray-500">
                                                        Tipo
                                                    </p>
                                                    <p className="mt-1 text-sm font-semibold">
                                                        {comandaDetalhe.tipo ===
                                                        'MESA'
                                                            ? 'Mesa'
                                                            : 'Balcão'}
                                                    </p>
                                                </div>

                                                <div>
                                                    <p className="text-xs text-gray-500">
                                                        Mesa
                                                    </p>
                                                    <p className="mt-1 text-sm font-semibold">
                                                        {comandaDetalhe.tipo ===
                                                        'MESA'
                                                            ? comandaDetalhe.mesa_numero ??
                                                              '—'
                                                            : 'Não vinculada'}
                                                    </p>
                                                </div>

                                                <div>
                                                    <p className="text-xs text-gray-500">
                                                        Cliente
                                                    </p>
                                                    <p className="mt-1 break-words text-sm font-semibold">
                                                        {comandaDetalhe.cliente_nome ||
                                                            'Não identificado'}
                                                    </p>
                                                </div>

                                                <div>
                                                    <p className="text-xs text-gray-500">
                                                        Aberta em
                                                    </p>
                                                    <p className="mt-1 text-sm font-semibold">
                                                        {formatarData(
                                                            comandaDetalhe.aberta_em ||
                                                                comandaDetalhe.created_at
                                                        )}
                                                    </p>
                                                </div>

                                                {comandaDetalhe.fechada_em && (
                                                    <div className="col-span-2">
                                                        <p className="text-xs text-gray-500">
                                                            Fechada em
                                                        </p>
                                                        <p className="mt-1 text-sm font-semibold">
                                                            {formatarData(
                                                                comandaDetalhe.fechada_em
                                                            )}
                                                        </p>
                                                    </div>
                                                )}
                                            </div>

                                            {comandaDetalhe.observacao && (
                                                <div className="mt-4 rounded-xl border border-amber-400/20 bg-amber-400/[0.04] p-3">
                                                    <p className="text-xs font-semibold text-amber-300">
                                                        Observação da comanda
                                                    </p>
                                                    <p className="mt-1 whitespace-pre-wrap text-sm text-gray-300">
                                                        {
                                                            comandaDetalhe.observacao
                                                        }
                                                    </p>
                                                </div>
                                            )}

                                            <p className="mt-4 break-all text-[10px] text-gray-600">
                                                ID: {comandaDetalhe.id}
                                            </p>
                                        </section>

                                        {/* Itens */}
                                        <section>
                                            <div className="flex items-center justify-between gap-3">
                                                <h3 className="text-base font-bold">
                                                    Itens lançados
                                                </h3>

                                                <span className="rounded-full bg-white/5 px-3 py-1 text-xs text-gray-400">
                                                    {
                                                        (
                                                            comandaDetalhe.itens ||
                                                            []
                                                        ).length
                                                    }{' '}
                                                    registro(s)
                                                </span>
                                            </div>

                                            {!comandaDetalhe.itens?.length ? (
                                                <div className="mt-3 rounded-xl border border-dashed border-white/15 p-6 text-center text-sm text-gray-400">
                                                    Nenhum item foi lançado
                                                    nesta comanda.
                                                </div>
                                            ) : (
                                                <div className="mt-3 space-y-3">
                                                    {comandaDetalhe.itens.map(
                                                        (item) => {
                                                            const cancelado =
                                                                item.status ===
                                                                'CANCELADO';

                                                            return (
                                                                <article
                                                                    key={item.id}
                                                                    className={`rounded-xl border p-3 sm:p-4 ${
                                                                        cancelado
                                                                            ? 'border-red-500/20 bg-red-500/[0.035]'
                                                                            : 'border-white/10 bg-white/[0.025]'
                                                                    }`}
                                                                >
                                                                    <div className="flex items-start justify-between gap-3">
                                                                        <div className="min-w-0">
                                                                            <p
                                                                                className={`break-words text-sm font-semibold ${
                                                                                    cancelado
                                                                                        ? 'text-gray-500 line-through'
                                                                                        : 'text-white'
                                                                                }`}
                                                                            >
                                                                                {
                                                                                    item.quantidade
                                                                                }{' '}
                                                                                ×{' '}
                                                                                {
                                                                                    item.produto_nome
                                                                                }
                                                                            </p>

                                                                            {item.status && (
                                                                                <span
                                                                                    className={`mt-2 inline-block rounded-full px-2 py-1 text-[10px] font-semibold ${
                                                                                        cancelado
                                                                                            ? 'bg-red-500/10 text-red-300'
                                                                                            : 'bg-[#65D69A]/10 text-[#8BE8B4]'
                                                                                    }`}
                                                                                >
                                                                                    {
                                                                                        item.status
                                                                                    }
                                                                                </span>
                                                                            )}

                                                                            {item.observacao && (
                                                                                <p className="mt-2 whitespace-pre-wrap text-xs text-amber-300">
                                                                                    Obs.:{' '}
                                                                                    {
                                                                                        item.observacao
                                                                                    }
                                                                                </p>
                                                                            )}

                                                                            {item.created_at && (
                                                                                <p className="mt-2 text-[10px] text-gray-500">
                                                                                    Lançado em{' '}
                                                                                    {formatarData(
                                                                                        item.created_at
                                                                                    )}
                                                                                </p>
                                                                            )}
                                                                        </div>

                                                                        <div className="shrink-0 text-right">
                                                                            <p className="text-sm font-bold">
                                                                                {formatarMoeda(
                                                                                    item.subtotal
                                                                                )}
                                                                            </p>
                                                                            <p className="mt-1 text-[10px] text-gray-500">
                                                                                {formatarMoeda(
                                                                                    item.preco_unitario
                                                                                )}{' '}
                                                                                cada
                                                                            </p>
                                                                        </div>
                                                                    </div>
                                                                </article>
                                                            );
                                                        }
                                                    )}
                                                </div>
                                            )}
                                        </section>

                                        {/* Resumo financeiro */}
                                        <section className="rounded-2xl border border-white/10 bg-white/[0.025] p-4">
                                            <h3 className="text-base font-bold">
                                                Resumo financeiro
                                            </h3>

                                            <div className="mt-4 space-y-3 text-sm">
                                                <div className="flex items-center justify-between gap-3">
                                                    <span className="text-gray-400">
                                                        Subtotal
                                                    </span>
                                                    <span>
                                                        {formatarMoeda(
                                                            comandaDetalhe.subtotal
                                                        )}
                                                    </span>
                                                </div>

                                                <div className="flex items-center justify-between gap-3">
                                                    <span className="text-gray-400">
                                                        Taxa de serviço
                                                    </span>
                                                    <span>
                                                        {formatarMoeda(
                                                            comandaDetalhe.taxa_servico ||
                                                                0
                                                        )}
                                                    </span>
                                                </div>

                                                <div className="flex items-center justify-between gap-3">
                                                    <span className="text-gray-400">
                                                        Desconto
                                                    </span>
                                                    <span>
                                                        {formatarMoeda(
                                                            comandaDetalhe.desconto ||
                                                                0
                                                        )}
                                                    </span>
                                                </div>

                                                <div className="border-t border-white/10 pt-3">
                                                    <div className="flex items-center justify-between gap-3">
                                                        <span className="font-semibold">
                                                            Total da comanda
                                                        </span>
                                                        <span className="text-xl font-bold text-[#65D69A]">
                                                            {formatarMoeda(
                                                                comandaDetalhe.total
                                                            )}
                                                        </span>
                                                    </div>
                                                </div>

                                                <div className="flex items-center justify-between gap-3">
                                                    <span className="text-gray-400">
                                                        Total pago
                                                    </span>
                                                    <span className="font-semibold text-[#8BE8B4]">
                                                        {formatarMoeda(
                                                            comandaDetalhe.total_pago ||
                                                                0
                                                        )}
                                                    </span>
                                                </div>

                                                <div className="flex items-center justify-between gap-3">
                                                    <span className="text-gray-400">
                                                        Saldo devedor
                                                    </span>
                                                    <span className="font-bold text-amber-300">
                                                        {formatarMoeda(
                                                            comandaDetalhe.saldo_devedor ??
                                                                Number(
                                                                    comandaDetalhe.total ||
                                                                        0
                                                                ) -
                                                                    Number(
                                                                        comandaDetalhe.total_pago ||
                                                                            0
                                                                    )
                                                        )}
                                                    </span>
                                                </div>
                                            </div>
                                        </section>

                                        {/* Pagamentos */}
                                        <section>
                                            <div className="flex items-center justify-between gap-3">
                                                <h3 className="text-base font-bold">
                                                    Pagamentos
                                                </h3>

                                                <span className="text-xs text-gray-500">
                                                    {
                                                        (
                                                            comandaDetalhe.pagamentos ||
                                                            []
                                                        ).length
                                                    }{' '}
                                                    registro(s)
                                                </span>
                                            </div>

                                            {!comandaDetalhe.pagamentos?.length ? (
                                                <div className="mt-3 rounded-xl border border-white/10 p-4 text-sm text-gray-400">
                                                    Nenhum pagamento registrado.
                                                </div>
                                            ) : (
                                                <div className="mt-3 space-y-3">
                                                    {comandaDetalhe.pagamentos.map(
                                                        (pagamento) => (
                                                            <article
                                                                key={pagamento.id}
                                                                className="rounded-xl border border-white/10 bg-white/[0.025] p-3"
                                                            >
                                                                <div className="flex items-start justify-between gap-3">
                                                                    <div className="min-w-0">
                                                                        <p className="text-sm font-semibold">
                                                                            {rotuloFormaPagamento(
                                                                                pagamento.forma_pagamento
                                                                            )}
                                                                        </p>

                                                                        <p className="mt-1 text-xs text-gray-400">
                                                                            {formatarData(
                                                                                pagamento.created_at
                                                                            )}
                                                                        </p>

                                                                        <p className="mt-1 text-[10px] text-gray-500">
                                                                            Status:{' '}
                                                                            {
                                                                                pagamento.status
                                                                            }
                                                                        </p>

                                                                        {pagamento.observacao && (
                                                                            <p className="mt-2 whitespace-pre-wrap text-xs text-gray-400">
                                                                                {
                                                                                    pagamento.observacao
                                                                                }
                                                                            </p>
                                                                        )}
                                                                    </div>

                                                                    <p className="shrink-0 font-bold text-[#8BE8B4]">
                                                                        {formatarMoeda(
                                                                            pagamento.valor
                                                                        )}
                                                                    </p>
                                                                </div>
                                                            </article>
                                                        )
                                                    )}
                                                </div>
                                            )}
                                        </section>
                                    </div>
                                )}
                        </div>

                        {/* Rodapé */}
                        <div className="shrink-0 border-t border-white/10 bg-[#171B17] px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 sm:px-6 sm:pb-4">
                            <div className="flex items-center justify-between gap-4">
                                <div className="min-w-0">
                                    <p className="text-xs text-gray-400">
                                        {comandaDetalhe
                                            ? comandaDetalhe.status
                                            : 'Consulta da comanda'}
                                    </p>
                                    <p className="mt-0.5 truncate text-lg font-bold text-[#65D69A]">
                                        {comandaDetalhe
                                            ? formatarMoeda(
                                                  comandaDetalhe.total
                                              )
                                            : '—'}
                                    </p>
                                </div>

                                <button
                                    type="button"
                                    onClick={() =>
                                        setModalComandaAberto(false)
                                    }
                                    className="min-h-12 flex-1 rounded-xl bg-[#65D69A] px-4 text-sm font-bold text-[#101310] transition hover:bg-[#7BE5AC] sm:max-w-xs"
                                >
                                    Fechar consulta
                                </button>
                            </div>
                        </div>
                    </section>
                </div>
            )}
        </main>
    );
}