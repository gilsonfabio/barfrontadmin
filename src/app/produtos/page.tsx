
'use client';

import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
import { useRouter } from 'next/navigation';

type Categoria = {
    id: string;
    nome: string;
    ativo: number | boolean;
};

type Subcategoria = {
    id: string;
    categoria_id: string;
    categoria_nome?: string;
    nome: string;
    ativo: number | boolean;
};

type Produto = {
    id: string;
    categoria_id: string | null;
    categoria_nome?: string | null;
    subcategoria_id: string | null;
    subcategoria_nome?: string | null;
    nome: string;
    descricao: string | null;
    preco: number | string;
    imagem_url: string | null;
    ativo: number | boolean;
    destaque: number | boolean;
    ordem: number;
};

type RespostaApi<T> = {
    status: boolean;
    message?: string;
    dados?: T;
};

type RespostaUpload = {
    status: boolean;
    message?: string;
    dados?: {
        url: string;
        public_id: string;
        formato: string;
        largura: number;
        altura: number;
        tamanho_bytes: number;
    };
};

type FormularioProduto = {
    categoria_id: string;
    subcategoria_id: string;
    nome: string;
    descricao: string;
    preco: string;
    imagem_url: string;
    destaque: boolean;
    ordem: string;
};

const API_URL = (
    process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3333'
).replace(/\/$/, '');

const TAMANHO_MAXIMO_IMAGEM = 5 * 1024 * 1024;

const TIPOS_IMAGEM_PERMITIDOS = [
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/avif',
];

const FORMULARIO_INICIAL: FormularioProduto = {
    categoria_id: '',
    subcategoria_id: '',
    nome: '',
    descricao: '',
    preco: '',
    imagem_url: '',
    destaque: false,
    ordem: '0',
};

function estaAtivo(valor: number | boolean): boolean {
    return valor === true || valor === 1;
}

function mensagemErro(
    erro: unknown,
    padrao: string
): string {
    return erro instanceof Error ? erro.message : padrao;
}

async function requisicao<T>(
    caminho: string,
    opcoes: RequestInit = {}
): Promise<RespostaApi<T>> {
    const token = sessionStorage.getItem('menuvivo_token');

    if (!token) {
        throw new Error('Sua sessão expirou. Entre novamente.');
    }

    const resposta = await fetch(`${API_URL}${caminho}`, {
        ...opcoes,
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
            ...opcoes.headers,
        },
    });

    let resultado: RespostaApi<T>;

    try {
        resultado = await resposta.json();
    } catch {
        throw new Error('O servidor retornou uma resposta inválida.');
    }

    if (resposta.status === 401) {
        sessionStorage.removeItem('menuvivo_token');
        sessionStorage.removeItem('menuvivo_usuario');
        window.location.href = '/login';

        throw new Error('Sua sessão expirou. Entre novamente.');
    }

    if (!resposta.ok || resultado.status === false) {
        throw new Error(
            resultado.message || 'Não foi possível concluir a operação.'
        );
    }

    return resultado;
}

export default function ProdutosPage() {
    const router = useRouter();

    const inputImagemRef = useRef<HTMLInputElement>(null);

    const [categorias, setCategorias] = useState<Categoria[]>([]);
    const [subcategorias, setSubcategorias] = useState<Subcategoria[]>([]);
    const [produtos, setProdutos] = useState<Produto[]>([]);

    const [formulario, setFormulario] =
        useState<FormularioProduto>(FORMULARIO_INICIAL);

    const [produtoEditando, setProdutoEditando] =
        useState<string | null>(null);

    const [imagemArquivo, setImagemArquivo] = useState<File | null>(null);
    const [previewImagem, setPreviewImagem] = useState('');

    const [filtroCategoria, setFiltroCategoria] = useState('');
    const [filtroStatus, setFiltroStatus] = useState('todos');
    const [busca, setBusca] = useState('');

    const [carregando, setCarregando] = useState(true);
    const [salvando, setSalvando] = useState(false);
    const [alterandoStatus, setAlterandoStatus] =
        useState<string | null>(null);

    const [erro, setErro] = useState('');
    const [sucesso, setSucesso] = useState('');

    // Cria uma URL temporária para mostrar a imagem selecionada.
    useEffect(() => {
        if (!imagemArquivo) {
            setPreviewImagem('');
            return;
        }

        const url = URL.createObjectURL(imagemArquivo);

        setPreviewImagem(url);

        return () => {
            URL.revokeObjectURL(url);
        };
    }, [imagemArquivo]);

    const carregarDados = useCallback(async () => {
        setCarregando(true);
        setErro('');

        try {
            const [
                resCategorias,
                resSubcategorias,
                resProdutos,
            ] = await Promise.all([
                requisicao<Categoria[]>('/categorias'),
                requisicao<Subcategoria[]>('/subcategorias'),
                requisicao<Produto[]>('/produtos'),
            ]);

            setCategorias(resCategorias.dados || []);
            setSubcategorias(resSubcategorias.dados || []);
            setProdutos(resProdutos.dados || []);
        } catch (error) {
            const mensagem = mensagemErro(
                error,
                'Não foi possível carregar os dados.'
            );

            setErro(mensagem);

            if (mensagem.includes('Entre novamente')) {
                router.replace('/login');
            }
        } finally {
            setCarregando(false);
        }
    }, [router]);

    useEffect(() => {
        const token = sessionStorage.getItem('menuvivo_token');
        const usuario = sessionStorage.getItem('menuvivo_usuario');

        if (!token || !usuario) {
            router.replace('/login');
            return;
        }

        carregarDados();
    }, [carregarDados, router]);

    const subcategoriasDisponiveis = useMemo(() => {
        if (!formulario.categoria_id) {
            return [];
        }

        return subcategorias.filter(
            (subcategoria) =>
                subcategoria.categoria_id === formulario.categoria_id &&
                estaAtivo(subcategoria.ativo)
        );
    }, [subcategorias, formulario.categoria_id]);

    const produtosFiltrados = useMemo(() => {
        const termo = busca.trim().toLocaleLowerCase('pt-BR');

        return produtos.filter((produto) => {
            const correspondeBusca =
                !termo ||
                produto.nome.toLocaleLowerCase('pt-BR').includes(termo) ||
                (produto.descricao || '')
                    .toLocaleLowerCase('pt-BR')
                    .includes(termo);

            const correspondeCategoria =
                !filtroCategoria ||
                produto.categoria_id === filtroCategoria;

            const ativo = estaAtivo(produto.ativo);

            const correspondeStatus =
                filtroStatus === 'todos' ||
                (filtroStatus === 'ativos' && ativo) ||
                (filtroStatus === 'inativos' && !ativo);

            return (
                correspondeBusca &&
                correspondeCategoria &&
                correspondeStatus
            );
        });
    }, [produtos, busca, filtroCategoria, filtroStatus]);

    function atualizarCampo<K extends keyof FormularioProduto>(
        campo: K,
        valor: FormularioProduto[K]
    ) {
        setFormulario((anterior) => ({
            ...anterior,
            [campo]: valor,
        }));
    }

    function limparFormulario() {
        setFormulario({ ...FORMULARIO_INICIAL });
        setProdutoEditando(null);
        setImagemArquivo(null);
        setErro('');
        setSucesso('');

        if (inputImagemRef.current) {
            inputImagemRef.current.value = '';
        }
    }

    function selecionarImagem(arquivo: File | null) {
        setErro('');
        setSucesso('');

        if (!arquivo) {
            return;
        }

        if (!TIPOS_IMAGEM_PERMITIDOS.includes(arquivo.type)) {
            setErro(
                'Formato inválido. Selecione uma imagem JPG, PNG, WebP ou AVIF.'
            );

            if (inputImagemRef.current) {
                inputImagemRef.current.value = '';
            }

            return;
        }

        if (arquivo.size > TAMANHO_MAXIMO_IMAGEM) {
            setErro('A imagem deve ter no máximo 5 MB.');

            if (inputImagemRef.current) {
                inputImagemRef.current.value = '';
            }

            return;
        }

        setImagemArquivo(arquivo);
    }

    // Envia a imagem como multipart/form-data para a API.
    async function enviarImagem(
        arquivo: File
    ): Promise<RespostaUpload> {
        const token = sessionStorage.getItem('menuvivo_token');

        if (!token) {
            throw new Error('Sua sessão expirou. Entre novamente.');
        }

        const dadosFormulario = new FormData();

        // Precisa corresponder a upload.single('imagem') no backend.
        dadosFormulario.append('imagem', arquivo);

        const resposta = await fetch(`${API_URL}/uploads/imagem`, {
            method: 'POST',
            headers: {
                Accept: 'application/json',
                Authorization: `Bearer ${token}`,
            },
            body: dadosFormulario,
        });

        let resultado: RespostaUpload;

        try {
            resultado = await resposta.json();
        } catch {
            throw new Error(
                'O servidor retornou uma resposta inválida no upload.'
            );
        }

        if (resposta.status === 401) {
            sessionStorage.removeItem('menuvivo_token');
            sessionStorage.removeItem('menuvivo_usuario');
            window.location.href = '/login';

            throw new Error('Sua sessão expirou. Entre novamente.');
        }

        if (!resposta.ok || resultado.status === false) {
            throw new Error(
                resultado.message ||
                    'Não foi possível enviar a imagem.'
            );
        }

        if (!resultado.dados?.url) {
            throw new Error(
                'O Cloudinary não retornou a URL da imagem.'
            );
        }

        return resultado;
    }

    async function salvarProduto(
        evento: React.FormEvent<HTMLFormElement>
    ) {
        evento.preventDefault();

        setErro('');
        setSucesso('');

        if (!formulario.nome.trim()) {
            setErro('Informe o nome do produto.');
            return;
        }

        if (formulario.preco.trim() === '') {
            setErro('Informe o preço do produto.');
            return;
        }

        // Aceita vírgula ou ponto como separador decimal.
        const preco = Number(
            formulario.preco.trim().replace(',', '.')
        );

        const ordem = Number(formulario.ordem);

        if (!Number.isFinite(preco) || preco < 0) {
            setErro('Informe um preço válido e não negativo.');
            return;
        }

        if (Math.round(preco * 100) !== preco * 100) {
            setErro('O preço deve ter no máximo duas casas decimais.');
            return;
        }

        if (!Number.isInteger(ordem) || ordem < 0) {
            setErro('A ordem deve ser um número inteiro não negativo.');
            return;
        }

        if (
            !formulario.categoria_id &&
            formulario.subcategoria_id
        ) {
            setErro(
                'Selecione uma categoria para usar uma subcategoria.'
            );
            return;
        }

        setSalvando(true);

        try {
            // Mantém a imagem existente se nenhuma nova for selecionada.
            let imagemUrl = formulario.imagem_url.trim() || null;

            // Se houver uma imagem nova, envia primeiro ao Cloudinary.
            if (imagemArquivo) {
                const resultadoUpload = await enviarImagem(imagemArquivo);

                imagemUrl = resultadoUpload.dados!.url;
            }

            const dados = {
                categoria_id: formulario.categoria_id || null,
                subcategoria_id: formulario.subcategoria_id || null,
                nome: formulario.nome.trim(),
                descricao: formulario.descricao.trim() || null,
                preco,
                imagem_url: imagemUrl,
                destaque: formulario.destaque,
                ordem,
            };

            const caminho = produtoEditando
                ? `/produtos/${produtoEditando}`
                : '/produtos';

            const resultado = await requisicao<Produto>(
                caminho,
                {
                    method: produtoEditando ? 'PUT' : 'POST',
                    body: JSON.stringify(dados),
                }
            );

            setSucesso(
                resultado.message ||
                    (produtoEditando
                        ? 'Produto atualizado com sucesso.'
                        : 'Produto cadastrado com sucesso.')
            );

            limparFormulario();

            await carregarDados();
        } catch (error) {
            setErro(
                mensagemErro(
                    error,
                    'Não foi possível salvar o produto.'
                )
            );
        } finally {
            setSalvando(false);
        }
    }

    function editarProduto(produto: Produto) {
        setErro('');
        setSucesso('');

        setProdutoEditando(produto.id);
        setImagemArquivo(null);

        if (inputImagemRef.current) {
            inputImagemRef.current.value = '';
        }

        setFormulario({
            categoria_id: produto.categoria_id || '',
            subcategoria_id: produto.subcategoria_id || '',
            nome: produto.nome,
            descricao: produto.descricao || '',
            preco: String(produto.preco).replace('.', ','),
            imagem_url: produto.imagem_url || '',
            destaque: estaAtivo(produto.destaque),
            ordem: String(produto.ordem ?? 0),
        });

        window.scrollTo({
            top: 0,
            behavior: 'smooth',
        });
    }

    async function alterarStatus(produto: Produto) {
        const novoStatus = !estaAtivo(produto.ativo);

        setErro('');
        setSucesso('');
        setAlterandoStatus(produto.id);

        try {
            const resultado = await requisicao<never>(
                `/produtos/${produto.id}/ativar`,
                {
                    method: 'PATCH',
                    body: JSON.stringify({
                        ativo: novoStatus,
                    }),
                }
            );

            setProdutos((anteriores) =>
                anteriores.map((item) =>
                    item.id === produto.id
                        ? { ...item, ativo: novoStatus }
                        : item
                )
            );

            setSucesso(
                resultado.message ||
                    (novoStatus
                        ? 'Produto ativado com sucesso.'
                        : 'Produto desativado com sucesso.')
            );
        } catch (error) {
            setErro(
                mensagemErro(
                    error,
                    'Não foi possível alterar o status.'
                )
            );
        } finally {
            setAlterandoStatus(null);
        }
    }

    const campo =
        'mt-1 w-full rounded-xl border border-white/10 bg-[#101310] px-3 py-3 text-sm text-white outline-none transition placeholder:text-gray-600 focus:border-[#65D69A]';

    return (
        <main className="min-h-screen bg-[#101310] text-white">
            <header className="border-b border-white/10 bg-[#1A1E1A]">
                <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4">
                    <div>
                        <h1 className="text-xl font-bold">
                            Menu
                            <span className="text-[#65D69A]">
                                Vivo
                            </span>
                        </h1>

                        <p className="text-xs text-gray-400">
                            Gerenciamento de produtos
                        </p>
                    </div>

                    <button
                        type="button"
                        onClick={() => router.push('/dashboard')}
                        className="rounded-lg border border-white/10 px-4 py-2 text-sm transition hover:bg-white/5"
                    >
                        Voltar ao painel
                    </button>
                </div>
            </header>

            <section className="mx-auto max-w-7xl px-5 py-8">
                <div className="mb-8">
                    <p className="text-sm font-medium text-[#65D69A]">
                        CARDÁPIO
                    </p>

                    <h2 className="mt-2 text-3xl font-bold">
                        Produtos
                    </h2>

                    <p className="mt-2 text-sm text-gray-400">
                        Cadastre preços, descrições, categorias e
                        destaques dos produtos do seu estabelecimento.
                    </p>
                </div>

                {erro && (
                    <div
                        role="alert"
                        className="mb-5 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300"
                    >
                        {erro}
                    </div>
                )}

                {sucesso && (
                    <div
                        role="status"
                        className="mb-5 rounded-xl border border-[#65D69A]/30 bg-[#65D69A]/10 px-4 py-3 text-sm text-[#65D69A]"
                    >
                        {sucesso}
                    </div>
                )}

                <section className="mb-8 rounded-2xl border border-white/10 bg-[#1A1E1A] p-5 sm:p-7">
                    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
                        <div>
                            <h3 className="text-lg font-semibold">
                                {produtoEditando
                                    ? 'Editar produto'
                                    : 'Cadastrar produto'}
                            </h3>

                            <p className="mt-1 text-sm text-gray-400">
                                Os campos marcados com * são obrigatórios.
                            </p>
                        </div>

                        {produtoEditando && (
                            <button
                                type="button"
                                onClick={limparFormulario}
                                disabled={salvando}
                                className="rounded-lg border border-white/10 px-3 py-2 text-sm hover:bg-white/5 disabled:opacity-50"
                            >
                                Cancelar edição
                            </button>
                        )}
                    </div>

                    <form onSubmit={salvarProduto}>
                        <div className="grid gap-5 md:grid-cols-2">
                            <div>
                                <label
                                    htmlFor="produto-nome"
                                    className="text-sm text-gray-300"
                                >
                                    Nome do produto *
                                </label>

                                <input
                                    id="produto-nome"
                                    className={campo}
                                    value={formulario.nome}
                                    onChange={(e) =>
                                        atualizarCampo(
                                            'nome',
                                            e.target.value
                                        )
                                    }
                                    maxLength={150}
                                    placeholder="Ex.: Hambúrguer artesanal"
                                    required
                                />
                            </div>

                            <div>
                                <label
                                    htmlFor="produto-preco"
                                    className="text-sm text-gray-300"
                                >
                                    Preço (R$) *
                                </label>

                                <input
                                    id="produto-preco"
                                    className={campo}
                                    type="text"
                                    inputMode="decimal"
                                    value={formulario.preco}
                                    onChange={(e) =>
                                        atualizarCampo(
                                            'preco',
                                            e.target.value
                                        )
                                    }
                                    placeholder="Ex.: 29,90"
                                    required
                                />
                            </div>

                            <div>
                                <label
                                    htmlFor="produto-categoria"
                                    className="text-sm text-gray-300"
                                >
                                    Categoria
                                </label>

                                <select
                                    id="produto-categoria"
                                    className={campo}
                                    value={formulario.categoria_id}
                                    onChange={(e) => {
                                        atualizarCampo(
                                            'categoria_id',
                                            e.target.value
                                        );

                                        atualizarCampo(
                                            'subcategoria_id',
                                            ''
                                        );
                                    }}
                                >
                                    <option value="">
                                        Sem categoria
                                    </option>

                                    {categorias
                                        .filter((categoria) =>
                                            estaAtivo(categoria.ativo)
                                        )
                                        .map((categoria) => (
                                            <option
                                                key={categoria.id}
                                                value={categoria.id}
                                            >
                                                {categoria.nome}
                                            </option>
                                        ))}
                                </select>
                            </div>

                            <div>
                                <label
                                    htmlFor="produto-subcategoria"
                                    className="text-sm text-gray-300"
                                >
                                    Subcategoria
                                </label>

                                <select
                                    id="produto-subcategoria"
                                    className={campo}
                                    value={formulario.subcategoria_id}
                                    onChange={(e) =>
                                        atualizarCampo(
                                            'subcategoria_id',
                                            e.target.value
                                        )
                                    }
                                    disabled={!formulario.categoria_id}
                                >
                                    <option value="">
                                        {formulario.categoria_id
                                            ? 'Sem subcategoria'
                                            : 'Selecione primeiro uma categoria'}
                                    </option>

                                    {subcategoriasDisponiveis.map(
                                        (subcategoria) => (
                                            <option
                                                key={subcategoria.id}
                                                value={subcategoria.id}
                                            >
                                                {subcategoria.nome}
                                            </option>
                                        )
                                    )}
                                </select>

                                <p className="mt-1 text-xs text-gray-500">
                                    As opções acompanham a categoria escolhida.
                                </p>
                            </div>

                            <div className="md:col-span-2">
                                <label
                                    htmlFor="produto-descricao"
                                    className="text-sm text-gray-300"
                                >
                                    Descrição
                                </label>

                                <textarea
                                    id="produto-descricao"
                                    className={`${campo} min-h-24 resize-y`}
                                    value={formulario.descricao}
                                    onChange={(e) =>
                                        atualizarCampo(
                                            'descricao',
                                            e.target.value
                                        )
                                    }
                                    placeholder="Descreva os ingredientes ou detalhes do produto."
                                />
                            </div>

                            {/* Upload e pré-visualização da imagem */}
                            <div className="md:col-span-2">
                                <label
                                    htmlFor="produto-imagem"
                                    className="text-sm text-gray-300"
                                >
                                    Imagem do produto
                                </label>

                                <p className="mt-1 text-xs text-gray-500">
                                    JPG, PNG, WebP ou AVIF. Tamanho máximo:
                                    5 MB. A imagem será enviada ao Cloudinary
                                    ao salvar o produto.
                                </p>

                                <input
                                    ref={inputImagemRef}
                                    id="produto-imagem"
                                    type="file"
                                    accept="image/jpeg,image/png,image/webp,image/avif"
                                    disabled={salvando}
                                    onChange={(e) =>
                                        selecionarImagem(
                                            e.target.files?.[0] || null
                                        )
                                    }
                                    className={`${campo} file:mr-4 file:rounded-lg file:border-0 file:bg-[#65D69A] file:px-3 file:py-2 file:text-sm file:font-semibold file:text-[#101310]`}
                                />

                                {previewImagem && (
                                    <div className="mt-4">
                                        <p className="mb-2 text-xs text-gray-400">
                                            Pré-visualização da nova imagem
                                        </p>

                                        <img
                                            src={previewImagem}
                                            alt="Pré-visualização da nova imagem"
                                            className="h-40 w-40 rounded-xl border border-white/10 object-cover"
                                        />

                                        <p className="mt-2 break-all text-xs text-gray-400">
                                            {imagemArquivo?.name}
                                        </p>

                                        <p className="mt-1 text-xs text-gray-500">
                                            {imagemArquivo
                                                ? `${(imagemArquivo.size / 1024).toFixed(1)} KB`
                                                : ''}
                                        </p>

                                        <button
                                            type="button"
                                            disabled={salvando}
                                            onClick={() => {
                                                setImagemArquivo(null);

                                                if (inputImagemRef.current) {
                                                    inputImagemRef.current.value = '';
                                                }
                                            }}
                                            className="mt-2 rounded-lg border border-white/10 px-3 py-2 text-xs hover:bg-white/5 disabled:opacity-50"
                                        >
                                            Remover nova imagem
                                        </button>
                                    </div>
                                )}

                                {!previewImagem &&
                                    formulario.imagem_url.trim() && (
                                        <div className="mt-4">
                                            <p className="mb-2 text-xs text-gray-400">
                                                Imagem atualmente cadastrada
                                            </p>

                                            <img
                                                src={formulario.imagem_url}
                                                alt="Imagem atual do produto"
                                                className="h-40 w-40 rounded-xl border border-white/10 object-cover"
                                            />

                                            <p className="mt-2 break-all text-xs text-gray-500">
                                                {formulario.imagem_url}
                                            </p>
                                        </div>
                                    )}
                            </div>

                            <div>
                                <label
                                    htmlFor="produto-ordem"
                                    className="text-sm text-gray-300"
                                >
                                    Ordem de exibição
                                </label>

                                <input
                                    id="produto-ordem"
                                    className={campo}
                                    type="number"
                                    min="0"
                                    step="1"
                                    value={formulario.ordem}
                                    onChange={(e) =>
                                        atualizarCampo(
                                            'ordem',
                                            e.target.value
                                        )
                                    }
                                />
                            </div>

                            <div className="flex items-center">
                                <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-white/10 p-4">
                                    <input
                                        type="checkbox"
                                        checked={formulario.destaque}
                                        disabled={salvando}
                                        onChange={(e) =>
                                            atualizarCampo(
                                                'destaque',
                                                e.target.checked
                                            )
                                        }
                                        className="h-4 w-4 accent-[#65D69A]"
                                    />

                                    <span>
                                        <span className="block text-sm font-medium">
                                            Produto em destaque
                                        </span>

                                        <span className="mt-1 block text-xs text-gray-400">
                                            Dar maior visibilidade no cardápio.
                                        </span>
                                    </span>
                                </label>
                            </div>
                        </div>

                        <div className="mt-6 flex flex-wrap gap-3">
                            <button
                                type="submit"
                                disabled={salvando}
                                className="rounded-xl bg-[#65D69A] px-5 py-3 text-sm font-semibold text-[#101310] transition hover:bg-[#7be4aa] disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                {salvando
                                    ? imagemArquivo
                                        ? 'Enviando imagem e salvando...'
                                        : 'Salvando...'
                                    : produtoEditando
                                      ? 'Salvar alterações'
                                      : 'Cadastrar produto'}
                            </button>

                            <button
                                type="button"
                                onClick={limparFormulario}
                                disabled={salvando}
                                className="rounded-xl border border-white/10 px-5 py-3 text-sm hover:bg-white/5 disabled:opacity-50"
                            >
                                Limpar
                            </button>
                        </div>
                    </form>
                </section>

                {/* Listagem de produtos */}
                <section className="rounded-2xl border border-white/10 bg-[#1A1E1A] p-5 sm:p-7">
                    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
                        <div>
                            <h3 className="text-lg font-semibold">
                                Produtos cadastrados
                            </h3>

                            <p className="mt-1 text-sm text-gray-400">
                                {produtosFiltrados.length}{' '}
                                {produtosFiltrados.length === 1
                                    ? 'produto encontrado'
                                    : 'produtos encontrados'}
                            </p>
                        </div>

                        <button
                            type="button"
                            onClick={carregarDados}
                            disabled={carregando}
                            className="rounded-lg border border-white/10 px-3 py-2 text-sm hover:bg-white/5 disabled:opacity-50"
                        >
                            {carregando
                                ? 'Atualizando...'
                                : 'Atualizar lista'}
                        </button>
                    </div>

                    <div className="mb-6 grid gap-3 md:grid-cols-3">
                        <div>
                            <label
                                htmlFor="filtro-busca"
                                className="text-xs text-gray-400"
                            >
                                Buscar produto
                            </label>

                            <input
                                id="filtro-busca"
                                className={campo}
                                value={busca}
                                onChange={(e) => setBusca(e.target.value)}
                                placeholder="Nome ou descrição"
                            />
                        </div>

                        <div>
                            <label
                                htmlFor="filtro-categoria"
                                className="text-xs text-gray-400"
                            >
                                Categoria
                            </label>

                            <select
                                id="filtro-categoria"
                                className={campo}
                                value={filtroCategoria}
                                onChange={(e) =>
                                    setFiltroCategoria(e.target.value)
                                }
                            >
                                <option value="">
                                    Todas as categorias
                                </option>

                                {categorias.map((categoria) => (
                                    <option
                                        key={categoria.id}
                                        value={categoria.id}
                                    >
                                        {categoria.nome}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label
                                htmlFor="filtro-status"
                                className="text-xs text-gray-400"
                            >
                                Situação
                            </label>

                            <select
                                id="filtro-status"
                                className={campo}
                                value={filtroStatus}
                                onChange={(e) =>
                                    setFiltroStatus(e.target.value)
                                }
                            >
                                <option value="todos">Todos</option>
                                <option value="ativos">Ativos</option>
                                <option value="inativos">Inativos</option>
                            </select>
                        </div>
                    </div>

                    {carregando ? (
                        <div className="py-12 text-center text-sm text-gray-400">
                            Carregando produtos...
                        </div>
                    ) : produtosFiltrados.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-white/10 px-4 py-12 text-center">
                            <p className="font-medium">
                                Nenhum produto encontrado
                            </p>

                            <p className="mt-2 text-sm text-gray-400">
                                Cadastre um produto ou ajuste os filtros.
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {produtosFiltrados.map((produto) => {
                                const ativo = estaAtivo(produto.ativo);
                                const destaque = estaAtivo(produto.destaque);

                                return (
                                    <article
                                        key={produto.id}
                                        className="flex flex-col gap-4 rounded-xl border border-white/10 bg-[#101310]/60 p-4 sm:flex-row sm:items-center"
                                    >
                                        {produto.imagem_url ? (
                                            <img
                                                src={produto.imagem_url}
                                                alt={produto.nome}
                                                className="h-20 w-20 shrink-0 rounded-xl object-cover"
                                            />
                                        ) : (
                                            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-xl bg-[#65D69A]/10 text-2xl text-[#65D69A]">
                                                ◈
                                            </div>
                                        )}

                                        <div className="min-w-0 flex-1">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <h4 className="font-semibold">
                                                    {produto.nome}
                                                </h4>

                                                <span
                                                    className={`rounded-full px-2 py-1 text-xs ${
                                                        ativo
                                                            ? 'bg-[#65D69A]/10 text-[#65D69A]'
                                                            : 'bg-gray-500/15 text-gray-400'
                                                    }`}
                                                >
                                                    {ativo ? 'Ativo' : 'Inativo'}
                                                </span>

                                                {destaque && (
                                                    <span className="rounded-full bg-amber-400/10 px-2 py-1 text-xs text-amber-300">
                                                        Destaque
                                                    </span>
                                                )}
                                            </div>

                                            <p className="mt-1 text-sm text-gray-400">
                                                {produto.categoria_nome ||
                                                    'Sem categoria'}

                                                {produto.subcategoria_nome
                                                    ? ` • ${produto.subcategoria_nome}`
                                                    : ''}
                                            </p>

                                            {produto.descricao && (
                                                <p className="mt-1 line-clamp-2 text-sm text-gray-500">
                                                    {produto.descricao}
                                                </p>
                                            )}

                                            <p className="mt-2 font-semibold text-[#65D69A]">
                                                {Number(
                                                    produto.preco
                                                ).toLocaleString('pt-BR', {
                                                    style: 'currency',
                                                    currency: 'BRL',
                                                })}
                                            </p>
                                        </div>

                                        <div className="flex shrink-0 flex-wrap gap-2 sm:flex-col">
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    editarProduto(produto)
                                                }
                                                className="rounded-lg border border-white/10 px-3 py-2 text-sm hover:bg-white/5"
                                            >
                                                Editar
                                            </button>

                                            <button
                                                type="button"
                                                disabled={
                                                    alterandoStatus === produto.id
                                                }
                                                onClick={() =>
                                                    alterarStatus(produto)
                                                }
                                                className={`rounded-lg border px-3 py-2 text-sm disabled:opacity-50 ${
                                                    ativo
                                                        ? 'border-red-500/20 text-red-300 hover:bg-red-500/10'
                                                        : 'border-[#65D69A]/20 text-[#65D69A] hover:bg-[#65D69A]/10'
                                                }`}
                                            >
                                                {alterandoStatus === produto.id
                                                    ? 'Aguarde...'
                                                    : ativo
                                                      ? 'Desativar'
                                                      : 'Ativar'}
                                            </button>
                                        </div>
                                    </article>
                                );
                            })}
                        </div>
                    )}
                </section>
            </section>
        </main>
    );
}
