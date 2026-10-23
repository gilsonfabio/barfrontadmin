 'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';

type Categoria = {
    id: string;
    nome: string;
    descricao: string | null;
    ordem: number;
    ativo: number | boolean;
    created_at?: string;
    updated_at?: string;
};

type RespostaApi<T> = {
    status: boolean;
    message?: string;
    dados?: T;
};

export default function CategoriasPage() {
    const router = useRouter();

    const [categorias, setCategorias] = useState<Categoria[]>([]);
    const [carregando, setCarregando] = useState(true);
    const [salvando, setSalvando] = useState(false);

    const [erro, setErro] = useState('');
    const [sucesso, setSucesso] = useState('');

    const [filtro, setFiltro] = useState('TODAS');
    const [nome, setNome] = useState('');
    const [descricao, setDescricao] = useState('');
    const [ordem, setOrdem] = useState('0');
    const [editando, setEditando] = useState<Categoria | null>(null);

    const apiUrl = process.env.NEXT_PUBLIC_API_URL;

    const requisicao = useCallback(
        async (caminho: string, opcoes: RequestInit = {}) => {
            const token = sessionStorage.getItem('menuvivo_token');

            if (!token) {
                router.replace('/login');
                throw new Error('Sua sessão expirou. Entre novamente.');
            }

            if (!apiUrl) {
                throw new Error(
                    'A variável NEXT_PUBLIC_API_URL não está configurada.'
                );
            }

            const resposta = await fetch(`${apiUrl}${caminho}`, {
                ...opcoes,
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                    ...opcoes.headers,
                },
            });

            const dados = await resposta.json().catch(() => null);

            if (resposta.status === 401) {
                sessionStorage.removeItem('menuvivo_token');
                sessionStorage.removeItem('menuvivo_usuario');

                router.replace('/login');

                throw new Error('Sessão expirada. Faça login novamente.');
            }

            if (!resposta.ok || !dados?.status) {
                throw new Error(
                    dados?.message || 'Não foi possível concluir a operação.'
                );
            }

            return dados as RespostaApi<unknown>;
        },
        [apiUrl, router]
    );

    const carregarCategorias = useCallback(async () => {
        setCarregando(true);
        setErro('');

        try {
            const query =
                filtro === 'TODAS'
                    ? ''
                    : `?ativo=${filtro === 'ATIVA' ? '1' : '0'}`;

            const resposta = await requisicao(`/categorias${query}`);

            setCategorias(
                Array.isArray(resposta.dados)
                    ? (resposta.dados as Categoria[])
                    : []
            );
        } catch (error) {
            setErro(
                error instanceof Error
                    ? error.message
                    : 'Erro ao carregar categorias.'
            );
        } finally {
            setCarregando(false);
        }
    }, [filtro, requisicao]);

    useEffect(() => {
        const token = sessionStorage.getItem('menuvivo_token');
        const usuario = sessionStorage.getItem('menuvivo_usuario');

        if (!token || !usuario) {
            router.replace('/login');
            return;
        }

        void carregarCategorias();
    }, [carregarCategorias, router]);

    function limparFormulario() {
        setNome('');
        setDescricao('');
        setOrdem('0');
        setEditando(null);
    }

    async function salvarCategoria(evento: FormEvent<HTMLFormElement>) {
        evento.preventDefault();

        const nomeFinal = nome.trim();
        const ordemFinal = Number(ordem);

        if (!nomeFinal || nomeFinal.length > 100) {
            setErro('Informe um nome com até 100 caracteres.');
            return;
        }

        if (!Number.isInteger(ordemFinal) || ordemFinal < 0) {
            setErro('A ordem deve ser um número inteiro não negativo.');
            return;
        }

        setSalvando(true);
        setErro('');
        setSucesso('');

        try {
            const corpo = {
                nome: nomeFinal,
                descricao: descricao.trim() || null,
                ordem: ordemFinal,
            };

            const resposta = await requisicao(
                editando ? `/categorias/${editando.id}` : '/categorias',
                {
                    method: editando ? 'PUT' : 'POST',
                    body: JSON.stringify(corpo),
                }
            );

            setSucesso(
                resposta.message ||
                    (editando
                        ? 'Categoria atualizada com sucesso.'
                        : 'Categoria cadastrada com sucesso.')
            );

            limparFormulario();

            await carregarCategorias();
        } catch (error) {
            setErro(
                error instanceof Error
                    ? error.message
                    : 'Erro ao salvar categoria.'
            );
        } finally {
            setSalvando(false);
        }
    }

    async function alterarStatus(categoria: Categoria) {
        const ativoAtual =
            categoria.ativo === true ||
            categoria.ativo === 1;

        const novoAtivo = ativoAtual ? 0 : 1;

        setErro('');
        setSucesso('');

        try {
            const resposta = await requisicao(
                `/categorias/${categoria.id}/ativar`,
                {
                    method: 'PATCH',
                    body: JSON.stringify({ ativo: novoAtivo }),
                }
            );

            setSucesso(
                resposta.message ||
                    (novoAtivo
                        ? 'Categoria ativada com sucesso.'
                        : 'Categoria desativada com sucesso.')
            );

            await carregarCategorias();
        } catch (error) {
            setErro(
                error instanceof Error
                    ? error.message
                    : 'Erro ao alterar status da categoria.'
            );
        }
    }

    function editarCategoria(categoria: Categoria) {
        setEditando(categoria);
        setNome(categoria.nome);
        setDescricao(categoria.descricao || '');
        setOrdem(String(categoria.ordem ?? 0));
        setErro('');
        setSucesso('');

        window.scrollTo({
            top: 0,
            behavior: 'smooth',
        });
    }

    function sair() {
        sessionStorage.removeItem('menuvivo_token');
        sessionStorage.removeItem('menuvivo_usuario');
        router.replace('/login');
    }

    function categoriaAtiva(categoria: Categoria) {
        return (
            categoria.ativo === true ||
            categoria.ativo === 1
        );
    }

    return (
        <main className="min-h-screen bg-[#101310] text-white">
            <header className="border-b border-white/10 bg-[#1A1E1A]">
                <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4">
                    <div>
                        <h1 className="text-xl font-bold">
                            Menu<span className="text-[#65D69A]">Vivo</span>
                        </h1>

                        <p className="text-xs text-gray-400">
                            Gerenciamento de categorias
                        </p>
                    </div>

                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={() => router.push('/dashboard')}
                            className="rounded-lg border border-white/10 px-4 py-2 text-sm hover:bg-white/5"
                        >
                            Voltar
                        </button>

                        <button
                            type="button"
                            onClick={sair}
                            className="rounded-lg border border-white/10 px-4 py-2 text-sm hover:bg-white/5"
                        >
                            Sair
                        </button>
                    </div>
                </div>
            </header>

            <section className="mx-auto max-w-7xl space-y-8 px-5 py-8">
                <div>
                    <p className="text-sm text-[#65D69A]">ADMINISTRAÇÃO</p>

                    <h2 className="mt-2 text-3xl font-bold">
                        Categorias do cardápio
                    </h2>

                    <p className="mt-2 text-gray-400">
                        Organize os produtos do estabelecimento em categorias.
                    </p>
                </div>

                {erro && (
                    <div
                        role="alert"
                        className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300"
                    >
                        {erro}
                    </div>
                )}

                {sucesso && (
                    <div
                        role="status"
                        className="rounded-xl border border-[#65D69A]/30 bg-[#65D69A]/10 p-4 text-sm text-[#65D69A]"
                    >
                        {sucesso}
                    </div>
                )}

                <form
                    onSubmit={salvarCategoria}
                    className="space-y-5 rounded-2xl border border-white/10 bg-[#1A1E1A] p-6"
                >
                    <div>
                        <h3 className="text-lg font-semibold">
                            {editando ? 'Editar categoria' : 'Cadastrar categoria'}
                        </h3>

                        <p className="mt-1 text-sm text-gray-400">
                            {editando
                                ? 'Altere os dados da categoria selecionada.'
                                : 'Preencha os dados para adicionar uma categoria.'}
                        </p>
                    </div>

                    <div className="grid gap-5 md:grid-cols-3">
                        <label className="block text-sm text-gray-300 md:col-span-2">
                            Nome da categoria
                            <input
                                value={nome}
                                onChange={(evento) => setNome(evento.target.value)}
                                maxLength={100}
                                required
                                placeholder="Ex.: Bebidas, Porções, Sobremesas"
                                className="mt-2 w-full rounded-xl border border-white/10 bg-[#101310] px-4 py-3 outline-none focus:border-[#65D69A]"
                            />
                        </label>

                        <label className="block text-sm text-gray-300">
                            Ordem de exibição
                            <input
                                type="number"
                                min="0"
                                step="1"
                                value={ordem}
                                onChange={(evento) => setOrdem(evento.target.value)}
                                required
                                className="mt-2 w-full rounded-xl border border-white/10 bg-[#101310] px-4 py-3 outline-none focus:border-[#65D69A]"
                            />
                        </label>

                        <label className="block text-sm text-gray-300 md:col-span-3">
                            Descrição
                            <textarea
                                value={descricao}
                                onChange={(evento) =>
                                    setDescricao(evento.target.value)
                                }
                                rows={3}
                                maxLength={1000}
                                placeholder="Descrição opcional da categoria"
                                className="mt-2 w-full resize-y rounded-xl border border-white/10 bg-[#101310] px-4 py-3 outline-none focus:border-[#65D69A]"
                            />
                        </label>
                    </div>

                    <div className="flex flex-wrap gap-3">
                        <button
                            type="submit"
                            disabled={salvando}
                            className="rounded-xl bg-[#65D69A] px-5 py-3 font-semibold text-[#101310] disabled:opacity-50"
                        >
                            {salvando
                                ? 'Salvando...'
                                : editando
                                  ? 'Salvar alterações'
                                  : 'Cadastrar categoria'}
                        </button>

                        {editando && (
                            <button
                                type="button"
                                onClick={() => {
                                    limparFormulario();
                                    setErro('');
                                    setSucesso('');
                                }}
                                className="rounded-xl border border-white/10 px-5 py-3 hover:bg-white/5"
                            >
                                Cancelar edição
                            </button>
                        )}
                    </div>
                </form>

                <section className="overflow-hidden rounded-2xl border border-white/10 bg-[#1A1E1A]">
                    <div className="flex flex-col justify-between gap-4 border-b border-white/10 p-5 sm:flex-row sm:items-center">
                        <div>
                            <h3 className="text-lg font-semibold">
                                Categorias cadastradas
                            </h3>

                            <p className="mt-1 text-sm text-gray-400">
                                {categorias.length}{' '}
                                {categorias.length === 1
                                    ? 'categoria nesta listagem'
                                    : 'categorias nesta listagem'}
                            </p>
                        </div>

                        <div className="flex flex-wrap gap-3">
                            <select
                                value={filtro}
                                onChange={(evento) => setFiltro(evento.target.value)}
                                className="rounded-lg border border-white/10 bg-[#101310] px-3 py-2 text-sm"
                            >
                                <option value="TODAS">Todas</option>
                                <option value="ATIVA">Ativas</option>
                                <option value="INATIVA">Inativas</option>
                            </select>

                            <button
                                type="button"
                                onClick={() => void carregarCategorias()}
                                className="rounded-lg border border-white/10 px-4 py-2 text-sm hover:bg-white/5"
                            >
                                Atualizar
                            </button>
                        </div>
                    </div>

                    {carregando ? (
                        <div className="p-10 text-center text-gray-400">
                            Carregando categorias...
                        </div>
                    ) : categorias.length === 0 ? (
                        <div className="p-10 text-center text-gray-400">
                            Nenhuma categoria encontrada.
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-white/5 text-gray-400">
                                    <tr>
                                        <th className="px-5 py-4">Ordem</th>
                                        <th className="px-5 py-4">Categoria</th>
                                        <th className="px-5 py-4">Descrição</th>
                                        <th className="px-5 py-4">Status</th>
                                        <th className="px-5 py-4">Ações</th>
                                    </tr>
                                </thead>

                                <tbody className="divide-y divide-white/5">
                                    {categorias.map((categoria) => {
                                        const ativa = categoriaAtiva(categoria);

                                        return (
                                            <tr key={categoria.id}>
                                                <td className="px-5 py-4 text-gray-400">
                                                    {categoria.ordem}
                                                </td>

                                                <td className="px-5 py-4 font-medium">
                                                    {categoria.nome}
                                                </td>

                                                <td className="max-w-sm px-5 py-4 text-gray-400">
                                                    <span className="line-clamp-2">
                                                        {categoria.descricao || '—'}
                                                    </span>
                                                </td>

                                                <td className="px-5 py-4">
                                                    <span
                                                        className={
                                                            ativa
                                                                ? 'rounded-full bg-[#65D69A]/10 px-3 py-1 text-xs text-[#65D69A]'
                                                                : 'rounded-full bg-gray-500/10 px-3 py-1 text-xs text-gray-400'
                                                        }
                                                    >
                                                        {ativa ? 'ATIVA' : 'INATIVA'}
                                                    </span>
                                                </td>

                                                <td className="px-5 py-4">
                                                    <div className="flex flex-wrap gap-3">
                                                        <button
                                                            type="button"
                                                            onClick={() =>
                                                                editarCategoria(categoria)
                                                            }
                                                            className="text-blue-300 hover:underline"
                                                        >
                                                            Editar
                                                        </button>

                                                        <button
                                                            type="button"
                                                            onClick={() =>
                                                                void alterarStatus(categoria)
                                                            }
                                                            className={
                                                                ativa
                                                                    ? 'text-red-300 hover:underline'
                                                                    : 'text-[#65D69A] hover:underline'
                                                            }
                                                        >
                                                            {ativa ? 'Desativar' : 'Ativar'}
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </section>
            </section>
        </main>
    );
}
